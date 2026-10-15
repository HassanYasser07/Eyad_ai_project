-- Deterministic integration checks for a disposable local Supabase database.
-- Run only after the Phase 1 migration and with at least one auth.users row.
-- Everything is rolled back. Do not run this against production.
begin;

do $$
declare
  v_owner uuid;
  v_job_id uuid;
  v_timeout_job_id uuid;
  v_duplicate_job_id uuid;
  v_claim_one jsonb;
  v_claim_two jsonb;
  v_request jsonb;
  v_duplicate_request jsonb;
  v_balance_one numeric;
  v_balance_two numeric;
  v_before numeric;
  v_after numeric;
  v_project_id uuid;
  v_conversation_id uuid;
  v_message_id uuid;
  v_key text;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is null then raise exception 'Seed one auth.users row before running this local-only helper'; end if;

  insert into public.credit_accounts(owner_id, balance, lifetime_credited, lifetime_used, plan)
  values(v_owner, 50, 50, 0, 'free')
  on conflict(owner_id) do update set balance = 50, lifetime_credited = 50, lifetime_used = 0;

  -- Concurrent credit safety invariant: the locked balance cannot go negative
  -- after a debit at the boundary. The RPC's FOR UPDATE behavior is the
  -- concurrency primitive also exercised by parallel application requests.
  perform public.consume_eyad_credits(v_owner, 49.99, 'phase1_test', gen_random_uuid(), 'phase1 boundary test', '{}');
  begin
    perform public.consume_eyad_credits(v_owner, 0.02, 'phase1_test', gen_random_uuid(), 'phase1 overspend test', '{}');
    raise exception 'Expected insufficient balance on second debit';
  exception when others then
    if sqlerrm not like '%INSUFFICIENT_CREDITS%' then raise; end if;
  end;
  if (select balance from public.credit_accounts where owner_id = v_owner) < 0 then
    raise exception 'Concurrent credit consumption invariant failed: negative balance';
  end if;

  insert into public.projects(owner_id, name) values(v_owner, 'Phase 1 reliability test') returning id into v_project_id;
  insert into public.conversations(owner_id, project_id, title, status)
  values(v_owner, v_project_id, 'Phase 1 reliability test', 'active') returning id into v_conversation_id;
  insert into public.messages(owner_id, conversation_id, role, content)
  values(v_owner, v_conversation_id, 'user', 'phase1 test request') returning id into v_message_id;

  v_key := 'phase1-' || gen_random_uuid()::text;
  v_request := public.reserve_eyad_request_job(v_owner, v_key, v_project_id, v_conversation_id, v_message_id, 0.01,
    jsonb_build_object('action', 'generate', 'credit_cost', 0.01));
  v_duplicate_request := public.reserve_eyad_request_job(v_owner, v_key, v_project_id, v_conversation_id, v_message_id, 0.01,
    jsonb_build_object('action', 'generate', 'credit_cost', 0.01));
  v_job_id := (v_request -> 'job' ->> 'id')::uuid;
  v_duplicate_job_id := (v_duplicate_request -> 'job' ->> 'id')::uuid;
  if v_job_id is distinct from v_duplicate_job_id or (v_duplicate_request ->> 'created')::boolean then
    raise exception 'Duplicate request created a second job or reservation';
  end if;

  -- Only one simultaneous poll may obtain the persisted claim lease.
  update public.eyad_jobs set status = 'processing', started_at = now(),
    result = '{"status":"waiting_external","openai_response_ids":["test-response"]}'::jsonb
  where id = v_job_id;
  v_claim_one := public.claim_eyad_generation_job(v_job_id, v_owner);
  v_claim_two := public.claim_eyad_generation_job(v_job_id, v_owner);
  if not (v_claim_one ->> 'claimed')::boolean or (v_claim_two ->> 'claimed')::boolean then
    raise exception 'Simultaneous poll claim invariant failed';
  end if;

  -- Unique job/variant identities prevent duplicate finalization records.
  insert into public.assets(owner_id, job_id, variant_index, kind, name)
  values(v_owner, v_job_id, 1, 'image', 'phase1.png');
  begin
    insert into public.assets(owner_id, job_id, variant_index, kind, name)
    values(v_owner, v_job_id, 1, 'image', 'duplicate.png');
    raise exception 'Expected duplicate asset to be rejected';
  exception when unique_violation then null;
  end;

  insert into public.generations(owner_id, job_id, variant_index, status)
  values(v_owner, v_job_id, 1, 'completed');
  begin
    insert into public.generations(owner_id, job_id, variant_index, status)
    values(v_owner, v_job_id, 1, 'completed');
    raise exception 'Expected duplicate generation to be rejected';
  exception when unique_violation then null;
  end;

  insert into public.messages(owner_id, conversation_id, job_id, role, content)
  values(v_owner, v_conversation_id, v_job_id, 'assistant', 'final');
  begin
    insert into public.messages(owner_id, conversation_id, job_id, role, content)
    values(v_owner, v_conversation_id, v_job_id, 'assistant', 'duplicate final');
    raise exception 'Expected duplicate assistant message to be rejected';
  exception when unique_violation then null;
  end;

  -- The same refund reference may affect the balance only once.
  select balance into v_before from public.credit_accounts where owner_id = v_owner;
  v_balance_one := public.refund_eyad_credits(v_owner, 0.01, 'job', v_job_id, 'phase1 refund', '{}');
  v_balance_two := public.refund_eyad_credits(v_owner, 0.01, 'job', v_job_id, 'phase1 duplicate refund', '{}');
  select balance into v_after from public.credit_accounts where owner_id = v_owner;
  if v_balance_two <> v_balance_one or v_after <> v_before + 0.01 then
    raise exception 'Duplicate refund changed the balance more than once';
  end if;

  -- A stale processing job is failed and refunded by the server-side sweeper.
  v_request := public.reserve_eyad_request_job(v_owner, 'phase1-timeout-' || gen_random_uuid()::text,
    v_project_id, v_conversation_id, v_message_id, 0.01,
    jsonb_build_object('action', 'generate', 'credit_cost', 0.01));
  v_timeout_job_id := (v_request -> 'job' ->> 'id')::uuid;
  select balance into v_before from public.credit_accounts where owner_id = v_owner;
  update public.eyad_jobs set started_at = now() - interval '4 minutes', claim_token = null,
    claim_expires_at = null, status = 'processing',
    result = '{"status":"waiting_external","openai_response_ids":["test-response"]}'::jsonb
  where id = v_timeout_job_id;
  perform public.expire_stale_eyad_generation_jobs();
  if (select status from public.eyad_jobs where id = v_timeout_job_id) <> 'failed' then
    raise exception 'Timeout sweeper did not fail the stale job';
  end if;
  select balance into v_after from public.credit_accounts where owner_id = v_owner;
  if v_after <> v_before + 0.01 then raise exception 'Timeout sweeper did not refund the timed-out reservation'; end if;
end;
$$;

rollback;
