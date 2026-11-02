-- Phase 1: durable idempotency, exclusive poll claims, idempotent side effects,
-- refund deduplication, and database-driven timeout settlement.

alter table public.eyad_jobs
  add column if not exists idempotency_key text,
  add column if not exists claim_token uuid,
  add column if not exists claim_expires_at timestamptz;

create unique index if not exists eyad_jobs_owner_idempotency_key_uidx
  on public.eyad_jobs (owner_id, idempotency_key)
  where idempotency_key is not null;

alter table public.assets
  add column if not exists job_id uuid references public.eyad_jobs(id) on delete set null,
  add column if not exists variant_index integer;

alter table public.generations
  add column if not exists job_id uuid references public.eyad_jobs(id) on delete set null,
  add column if not exists variant_index integer;

alter table public.messages
  add column if not exists job_id uuid references public.eyad_jobs(id) on delete set null;

-- Job state and provider references are server-owned. User reads continue to
-- use the existing owner RLS policy; direct client writes would bypass claims.
revoke insert, update, delete on public.eyad_jobs from anon, authenticated;

create unique index if not exists assets_job_variant_uidx
  on public.assets (job_id, variant_index)
  where job_id is not null and variant_index is not null;

create unique index if not exists generations_job_variant_uidx
  on public.generations (job_id, variant_index)
  where job_id is not null and variant_index is not null;

create unique index if not exists messages_job_uidx
  on public.messages (job_id)
  where job_id is not null;

create unique index if not exists credit_transactions_refund_reference_uidx
  on public.credit_transactions (owner_id, reference_type, reference_id)
  where type = 'refund' and reference_type is not null and reference_id is not null;

-- A generation reservation and durable job are committed together. Advisory
-- locking serializes concurrent requests carrying the same owner/key pair.
create or replace function public.reserve_eyad_request_job(
  p_owner_id uuid,
  p_idempotency_key text,
  p_project_id uuid,
  p_conversation_id uuid,
  p_message_id uuid,
  p_amount numeric,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.eyad_jobs%rowtype;
  v_job_id uuid;
begin
  if p_owner_id is null or p_idempotency_key is null or length(p_idempotency_key) < 16 or length(p_idempotency_key) > 128 then
    raise exception 'invalid generation idempotency key';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid credit amount';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text || ':' || p_idempotency_key, 0));

  select * into v_job
  from public.eyad_jobs
  where owner_id = p_owner_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('created', false, 'job', to_jsonb(v_job));
  end if;

  v_job_id := gen_random_uuid();
  -- Keep consume_eyad_credits' account-row locking and insufficient-balance
  -- semantics. Any later INSERT failure rolls the debit back in this txn.
  perform public.consume_eyad_credits(
    p_owner_id, p_amount, 'job', v_job_id,
    case when p_payload ->> 'action' = 'generate'
      then 'EYAD image-generation reservation'
      else 'EYAD request reservation' end,
    jsonb_build_object('idempotency_key', p_idempotency_key)
  );

  insert into public.eyad_jobs (
    id, owner_id, project_id, conversation_id, message_id, type, status,
    payload, idempotency_key
  ) values (
    v_job_id, p_owner_id, p_project_id, p_conversation_id, p_message_id,
    'eyad_request', 'queued', coalesce(p_payload, '{}'::jsonb), p_idempotency_key
  ) returning * into v_job;

  return jsonb_build_object('created', true, 'job', to_jsonb(v_job));
end;
$$;

revoke all on function public.reserve_eyad_request_job(uuid,text,uuid,uuid,uuid,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.reserve_eyad_request_job(uuid,text,uuid,uuid,uuid,numeric,jsonb) to service_role;

-- Upgrade a planner-discovered generation reservation and persist its final
-- reserved amount atomically, so a function crash cannot lose refund metadata.
create or replace function public.upgrade_eyad_job_credit_reservation(
  p_owner_id uuid,
  p_job_id uuid,
  p_target_amount numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.eyad_jobs%rowtype;
  v_current_amount numeric;
  v_extra_amount numeric;
begin
  if p_owner_id is null or p_job_id is null then raise exception 'owner and job required'; end if;
  if p_target_amount is null or p_target_amount <= 0 then raise exception 'invalid credit amount'; end if;

  select * into v_job from public.eyad_jobs where id = p_job_id and owner_id = p_owner_id for update;
  if not found then raise exception 'job not found'; end if;
  v_current_amount := greatest(0, coalesce((v_job.payload ->> 'credit_cost')::numeric, 0));
  if v_current_amount >= p_target_amount then return v_current_amount; end if;

  v_extra_amount := p_target_amount - v_current_amount;
  perform public.consume_eyad_credits(
    p_owner_id, v_extra_amount, 'job', p_job_id,
    'EYAD image-generation credit upgrade',
    jsonb_build_object('job_id', p_job_id, 'target_amount', p_target_amount)
  );

  update public.eyad_jobs
  set payload = jsonb_set(coalesce(payload, '{}'::jsonb), '{credit_cost}', to_jsonb(p_target_amount), true),
      updated_at = now()
  where id = p_job_id and owner_id = p_owner_id;
  return p_target_amount;
end;
$$;

revoke all on function public.upgrade_eyad_job_credit_reservation(uuid,uuid,numeric) from public, anon, authenticated;
grant execute on function public.upgrade_eyad_job_credit_reservation(uuid,uuid,numeric) to service_role;

-- A successful caller atomically obtains a short lease. A second poll sees
-- claimed=false and cannot perform provider calls or any finalization writes.
create or replace function public.claim_eyad_generation_job(p_job_id uuid, p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.eyad_jobs%rowtype;
begin
  update public.eyad_jobs
  set claim_token = gen_random_uuid(),
      claim_expires_at = now() + interval '5 minutes',
      updated_at = now()
  where id = p_job_id
    and owner_id = p_owner_id
    and status = 'processing'
    and result ->> 'status' = 'waiting_external'
    and (claim_expires_at is null or claim_expires_at <= now())
  returning * into v_job;

  if found then
    return jsonb_build_object('claimed', true, 'job', to_jsonb(v_job));
  end if;

  select * into v_job from public.eyad_jobs where id = p_job_id and owner_id = p_owner_id;
  if not found then
    return jsonb_build_object('claimed', false, 'not_found', true);
  end if;
  return jsonb_build_object('claimed', false, 'job', to_jsonb(v_job));
end;
$$;

revoke all on function public.claim_eyad_generation_job(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_eyad_generation_job(uuid,uuid) to service_role;

-- Require a stable reference and make duplicate refunds a no-op. The partial
-- unique index is the final concurrency guard; account and ledger changes share
-- the same database transaction.
create or replace function public.refund_eyad_credits(
  p_owner_id uuid,
  p_amount numeric,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
begin
  if p_owner_id is null then raise exception 'owner required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid credit amount'; end if;
  if p_reference_type is null or p_reference_id is null then raise exception 'refund reference required'; end if;

  insert into public.credit_accounts(owner_id, balance, lifetime_credited, lifetime_used, plan)
  values (p_owner_id, 50, 50, 0, 'free')
  on conflict (owner_id) do nothing;

  select balance into v_balance from public.credit_accounts where owner_id = p_owner_id for update;

  if exists (
    select 1 from public.credit_transactions
    where owner_id = p_owner_id and type = 'refund'
      and reference_type = p_reference_type and reference_id = p_reference_id
  ) then
    return v_balance;
  end if;

  update public.credit_accounts
  set balance = balance + p_amount,
      lifetime_credited = lifetime_credited + p_amount,
      lifetime_used = greatest(0, lifetime_used - p_amount),
      updated_at = now()
  where owner_id = p_owner_id
  returning balance into v_balance;

  insert into public.credit_transactions(owner_id, amount, type, reference_type, reference_id, description, metadata)
  values (p_owner_id, p_amount, 'refund', p_reference_type, p_reference_id, p_description, coalesce(p_metadata, '{}'::jsonb));

  return v_balance;
end;
$$;

revoke all on function public.refund_eyad_credits(uuid,numeric,text,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.refund_eyad_credits(uuid,numeric,text,uuid,text,jsonb) to service_role;

-- SQL-only sweeper: jobs that have exceeded their generation window are
-- terminally failed and refunded in the same transaction, even with no browser
-- polling. Active poll leases are allowed to finish before timeout settlement.
create or replace function public.expire_stale_eyad_generation_jobs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.eyad_jobs%rowtype;
  v_cost numeric;
  v_detail text;
  v_count integer := 0;
begin
  for v_job in
    select * from public.eyad_jobs
    where status = 'processing'
      and result ->> 'status' = 'waiting_external'
      and coalesce(started_at, created_at) <= now() - case
        when result ->> 'mockup_type' is not null then interval '120 seconds'
        else interval '180 seconds'
      end
      and (claim_expires_at is null or claim_expires_at <= now())
    for update skip locked
  loop
    v_cost := greatest(0, coalesce((v_job.payload ->> 'credit_cost')::numeric, 0));
    v_detail := case when v_job.result ->> 'mockup_type' is not null
      then 'MOCKUP_GENERATION_TIMEOUT' else 'IMAGE_GENERATION_TIMEOUT' end;

    if v_cost > 0 then
      perform public.refund_eyad_credits(
        v_job.owner_id, v_cost, 'job', v_job.id,
        'Refund after database generation timeout',
        jsonb_build_object('job_id', v_job.id, 'timeout_reconciled', true)
      );
    end if;

    update public.eyad_jobs
    set status = 'failed', error = v_detail,
        result = jsonb_build_object('ok', false, 'status', 'failed', 'error', v_detail, 'detail', v_detail),
        completed_at = now(), claim_token = null, claim_expires_at = null, updated_at = now()
    where id = v_job.id and status = 'processing';
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.expire_stale_eyad_generation_jobs() from public, anon, authenticated;
grant execute on function public.expire_stale_eyad_generation_jobs() to service_role;

create extension if not exists pg_cron with schema pg_catalog;
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'eyad-generation-timeout-sweeper' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'eyad-generation-timeout-sweeper',
    '* * * * *',
    'select public.expire_stale_eyad_generation_jobs();'
  );
end;
$$;
