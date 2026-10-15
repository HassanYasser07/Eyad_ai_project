-- Phase 1 durable request, claim, finalization, credit, and timeout guarantees.
-- Existing rows remain valid: new identity columns are nullable and old jobs
-- are reconciled from their current status/timestamps/payload.

CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE public.eyad_jobs
  ADD COLUMN IF NOT EXISTS request_key text,
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz;

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS job_id uuid,
  ADD COLUMN IF NOT EXISTS variant_index integer;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS job_id uuid;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS job_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS eyad_jobs_owner_request_key_uidx
  ON public.eyad_jobs(owner_id, request_key)
  WHERE request_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS generations_job_variant_uidx
  ON public.generations(job_id, variant_index)
  WHERE job_id IS NOT NULL AND variant_index IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS assets_job_storage_uidx
  ON public.assets(job_id, storage_path)
  WHERE job_id IS NOT NULL AND storage_path IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS messages_job_role_uidx
  ON public.messages(job_id, role)
  WHERE job_id IS NOT NULL;

-- Shared durable operation identities are used for both usage and refund
-- operations. Preserve historical ledger rows and balances while seeding
-- refund identities so legacy references remain blocked.
CREATE TABLE IF NOT EXISTS public.eyad_credit_operation_keys (
  operation_type text NOT NULL CHECK (operation_type IN ('usage', 'refund')),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_type text NOT NULL,
  reference_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (operation_type, owner_id, reference_type, reference_id)
);
ALTER TABLE public.eyad_credit_operation_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.eyad_credit_operation_keys FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.eyad_credit_operation_keys TO service_role;
CREATE INDEX IF NOT EXISTS eyad_credit_operation_keys_owner_idx
  ON public.eyad_credit_operation_keys(owner_id);
DROP POLICY IF EXISTS "service role manages eyad credit operation keys" ON public.eyad_credit_operation_keys;
CREATE POLICY "service role manages eyad credit operation keys"
  ON public.eyad_credit_operation_keys FOR ALL TO service_role
  USING (true) WITH CHECK (true);
INSERT INTO public.eyad_credit_operation_keys(operation_type, owner_id, reference_type, reference_id, amount, created_at)
SELECT DISTINCT ON (operation_type, owner_id, reference_type, reference_id)
  operation_type, owner_id, reference_type, reference_id, amount, created_at
FROM (
  SELECT 'usage'::text AS operation_type, owner_id, reference_type, reference_id, -amount AS amount, created_at
  FROM public.credit_transactions
  WHERE type = 'usage' AND reference_type IS NOT NULL AND reference_id IS NOT NULL
  UNION ALL
  SELECT 'refund'::text AS operation_type, owner_id, reference_type, reference_id, amount, created_at
  FROM public.credit_transactions
  WHERE type = 'refund' AND reference_type IS NOT NULL AND reference_id IS NOT NULL
) historical_operations
ORDER BY operation_type, owner_id, reference_type, reference_id, created_at
ON CONFLICT (operation_type, owner_id, reference_type, reference_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.consume_eyad_credits(
  p_owner_id uuid,
  p_amount numeric,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_balance numeric;
  v_existing_amount numeric;
  v_key_inserted integer;
BEGIN
  IF p_owner_id IS NULL THEN RAISE EXCEPTION 'owner required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid credit amount'; END IF;

  INSERT INTO public.credit_accounts(owner_id, balance, lifetime_credited, lifetime_used, plan)
  VALUES (p_owner_id, 50, 50, 0, 'free')
  ON CONFLICT (owner_id) DO NOTHING;

  -- Preserve the existing per-owner serialization and insufficient-balance guard.
  SELECT balance INTO v_balance
  FROM public.credit_accounts
  WHERE owner_id = p_owner_id
  FOR UPDATE;

  IF p_reference_type IS NOT NULL AND p_reference_id IS NOT NULL THEN
    INSERT INTO public.eyad_credit_operation_keys(operation_type, owner_id, reference_type, reference_id, amount)
    VALUES ('usage', p_owner_id, p_reference_type, p_reference_id, p_amount)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_key_inserted = ROW_COUNT;
    IF v_key_inserted = 0 THEN
      SELECT amount INTO v_existing_amount FROM public.eyad_credit_operation_keys
      WHERE operation_type = 'usage' AND owner_id = p_owner_id
        AND reference_type = p_reference_type AND reference_id = p_reference_id;
      IF v_existing_amount <> p_amount THEN
        RAISE EXCEPTION 'IDEMPOTENCY_AMOUNT_MISMATCH';
      END IF;
      RETURN v_balance;
    END IF;
  END IF;

  IF COALESCE(v_balance, 0) < p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;

  UPDATE public.credit_accounts
  SET balance = balance - p_amount,
      lifetime_used = lifetime_used + p_amount,
      updated_at = now()
  WHERE owner_id = p_owner_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.credit_transactions(owner_id, amount, type, reference_type, reference_id, description, metadata)
  VALUES (p_owner_id, -p_amount, 'usage', p_reference_type, p_reference_id, p_description, COALESCE(p_metadata, '{}'::jsonb));

  RETURN v_balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refund_eyad_credits(
  p_owner_id uuid,
  p_amount numeric,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_balance numeric;
  v_existing_amount numeric;
  v_key_inserted integer;
BEGIN
  IF p_owner_id IS NULL THEN RAISE EXCEPTION 'owner required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid credit amount'; END IF;
  IF p_reference_type IS NULL OR p_reference_id IS NULL THEN RAISE EXCEPTION 'refund reference required'; END IF;

  INSERT INTO public.credit_accounts(owner_id, balance, lifetime_credited, lifetime_used, plan)
  VALUES (p_owner_id, 50, 50, 0, 'free')
  ON CONFLICT (owner_id) DO NOTHING;

  -- This lock serializes all credit mutations for the owner, including retries.
  SELECT balance INTO v_balance
  FROM public.credit_accounts
  WHERE owner_id = p_owner_id
  FOR UPDATE;

  INSERT INTO public.eyad_credit_operation_keys(operation_type, owner_id, reference_type, reference_id, amount)
  VALUES ('refund', p_owner_id, p_reference_type, p_reference_id, p_amount)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_key_inserted = ROW_COUNT;
  IF v_key_inserted = 0 THEN
    SELECT amount INTO v_existing_amount FROM public.eyad_credit_operation_keys
    WHERE operation_type = 'refund' AND owner_id = p_owner_id
      AND reference_type = p_reference_type AND reference_id = p_reference_id;
    IF v_existing_amount <> p_amount THEN
      RAISE EXCEPTION 'IDEMPOTENCY_AMOUNT_MISMATCH';
    END IF;
    RETURN v_balance;
  END IF;

  UPDATE public.credit_accounts
  SET balance = balance + p_amount,
      lifetime_credited = lifetime_credited + p_amount,
      lifetime_used = greatest(0, lifetime_used - p_amount),
      updated_at = now()
  WHERE owner_id = p_owner_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.credit_transactions(owner_id, amount, type, reference_type, reference_id, description, metadata)
  VALUES (p_owner_id, p_amount, 'refund', p_reference_type, p_reference_id, p_description, COALESCE(p_metadata, '{}'::jsonb));

  RETURN v_balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_eyad_job_idempotent(
  p_owner_id uuid,
  p_request_key text,
  p_project_id uuid,
  p_conversation_id uuid,
  p_message_content text,
  p_message_metadata jsonb,
  p_job_payload jsonb,
  p_credit_cost numeric,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.eyad_jobs%ROWTYPE;
  v_message public.messages%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_conversation public.conversations%ROWTYPE;
  v_payload jsonb;
  v_job_id uuid;
BEGIN
  IF p_owner_id IS NULL OR p_request_key IS NULL THEN RAISE EXCEPTION 'owner and request key required'; END IF;
  IF p_credit_cost IS NULL OR p_credit_cost <= 0 THEN RAISE EXCEPTION 'invalid credit amount'; END IF;

  -- Serialize key contenders before creating any message, job, or debit.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner_id::text || ':' || p_request_key::text, 0));
  SELECT * INTO v_job FROM public.eyad_jobs
  WHERE owner_id = p_owner_id AND request_key = p_request_key;
  IF FOUND THEN
    SELECT * INTO v_message FROM public.messages WHERE id = v_job.message_id;
    SELECT * INTO v_project FROM public.projects WHERE id = v_job.project_id AND owner_id = p_owner_id;
    SELECT * INTO v_conversation FROM public.conversations WHERE id = v_job.conversation_id AND owner_id = p_owner_id;
    RETURN jsonb_build_object('job', to_jsonb(v_job), 'message', to_jsonb(v_message),
      'project', to_jsonb(v_project), 'conversation', to_jsonb(v_conversation), 'replayed', true);
  END IF;

  -- Project, conversation, message, credit debit, and job creation share the
  -- request-key transaction lock so retries cannot leave duplicate side effects.
  IF p_project_id IS NOT NULL THEN
    SELECT * INTO v_project FROM public.projects WHERE id = p_project_id AND owner_id = p_owner_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  ELSE
    INSERT INTO public.projects(owner_id, name, description, studio_type, status, language, metadata)
    VALUES (p_owner_id,
      COALESCE(NULLIF(p_job_payload#>>'{_request_project,name}', ''), 'مشروع جديد'),
      COALESCE(p_job_payload#>>'{_request_project,description}', p_message_content),
      p_job_payload#>>'{_request_project,studio_type}', 'draft',
      COALESCE(NULLIF(p_job_payload#>>'{_request_project,language}', ''), 'ar'),
      COALESCE(p_job_payload#>'{_request_project,metadata}', '{}'::jsonb))
    RETURNING * INTO v_project;
  END IF;

  IF p_conversation_id IS NOT NULL THEN
    SELECT * INTO v_conversation FROM public.conversations
    WHERE id = p_conversation_id AND owner_id = p_owner_id AND project_id = v_project.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'CONVERSATION_NOT_FOUND'; END IF;
  ELSE
    SELECT * INTO v_conversation FROM public.conversations
    WHERE owner_id = p_owner_id AND project_id = v_project.id AND status = 'active'
    ORDER BY updated_at DESC LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.conversations(owner_id, project_id, title, context, status)
      VALUES (p_owner_id, v_project.id,
        COALESCE(NULLIF(p_job_payload#>>'{_request_conversation,title}', ''), v_project.name),
        COALESCE(p_job_payload#>'{_request_conversation,context}', '{}'::jsonb), 'active')
      RETURNING * INTO v_conversation;
    END IF;
  END IF;

  v_job_id := gen_random_uuid();
  v_payload := COALESCE(p_job_payload, '{}'::jsonb) - '_request_project' - '_request_conversation';
  v_payload := jsonb_set(v_payload, '{project_id}', to_jsonb(v_project.id), true);
  INSERT INTO public.messages(conversation_id, owner_id, role, content, parts, metadata, credit_cost)
  VALUES (v_conversation.id, p_owner_id, 'user', p_message_content, '[]'::jsonb,
    COALESCE(p_message_metadata, '{}'::jsonb), p_credit_cost)
  RETURNING * INTO v_message;

  PERFORM public.consume_eyad_credits(
    p_owner_id, p_credit_cost, 'message', v_message.id,
    CASE WHEN p_action = 'generate' THEN 'EYAD image-generation reservation' ELSE 'EYAD request reservation' END,
    jsonb_build_object('action', p_action, 'project_id', v_project.id, 'job_id', v_job_id)
  );

  INSERT INTO public.eyad_jobs(id, owner_id, project_id, conversation_id, message_id, type, status, payload, request_key)
  VALUES (v_job_id, p_owner_id, v_project.id, v_conversation.id, v_message.id, 'eyad_request', 'queued',
    v_payload, p_request_key)
  RETURNING * INTO v_job;

  UPDATE public.messages SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'job_id', v_job.id, 'job_status', 'queued', 'credit_cost', p_credit_cost
  ), job_id = v_job.id WHERE id = v_message.id RETURNING * INTO v_message;

  RETURN jsonb_build_object('job', to_jsonb(v_job), 'message', to_jsonb(v_message),
    'project', to_jsonb(v_project), 'conversation', to_jsonb(v_conversation), 'replayed', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_eyad_job(
  p_owner_id uuid,
  p_job_id uuid,
  p_lease_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.eyad_jobs%ROWTYPE;
  v_token uuid := gen_random_uuid();
  v_seconds integer := greatest(30, least(coalesce(p_lease_seconds, 300), 1800));
BEGIN
  IF p_owner_id IS NULL OR p_job_id IS NULL THEN RAISE EXCEPTION 'job owner and id required'; END IF;
  UPDATE public.eyad_jobs SET status = 'processing', claim_token = v_token,
    lease_until = now() + make_interval(secs => v_seconds),
    started_at = COALESCE(started_at, now()), updated_at = now()
  WHERE id = p_job_id AND owner_id = p_owner_id
    AND (status = 'queued' OR (status = 'processing' AND (lease_until IS NULL OR lease_until < now())))
  RETURNING * INTO v_job;
  IF NOT FOUND THEN
    SELECT * INTO v_job FROM public.eyad_jobs WHERE id = p_job_id AND owner_id = p_owner_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'JOB_NOT_FOUND'; END IF;
    RETURN jsonb_build_object('claimed', false, 'job_id', v_job.id, 'status', v_job.status,
      'claim_token', v_job.claim_token, 'lease_until', v_job.lease_until);
  END IF;
  RETURN jsonb_build_object('claimed', true, 'job_id', v_job.id, 'status', v_job.status,
    'claim_token', v_job.claim_token, 'lease_until', v_job.lease_until);
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_eyad_job_claim(p_owner_id uuid, p_job_id uuid, p_claim_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_updated integer;
BEGIN
  UPDATE public.eyad_jobs SET claim_token = NULL, lease_until = NULL, updated_at = now()
  WHERE id = p_job_id AND owner_id = p_owner_id AND claim_token = p_claim_token AND status = 'processing';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fail_eyad_job(
  p_job_id uuid,
  p_owner_id uuid,
  p_error text,
  p_result jsonb DEFAULT NULL,
  p_claim_token uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.eyad_jobs%ROWTYPE;
  v_cost numeric;
BEGIN
  SELECT * INTO v_job FROM public.eyad_jobs
  WHERE id = p_job_id AND owner_id = p_owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'JOB_NOT_FOUND'; END IF;
  IF v_job.status = 'failed' OR v_job.status = 'completed' THEN
    RETURN jsonb_build_object('job', to_jsonb(v_job), 'replayed', true);
  END IF;
  IF p_claim_token IS NOT NULL AND v_job.claim_token IS DISTINCT FROM p_claim_token THEN
    RAISE EXCEPTION 'JOB_CLAIM_LOST';
  END IF;

  v_cost := COALESCE((v_job.payload->>'credit_cost')::numeric, 0);
  UPDATE public.eyad_jobs SET status = 'failed', error = COALESCE(p_error, 'EYAD_JOB_FAILED'),
    result = COALESCE(p_result, jsonb_build_object('ok', false, 'status', 'failed', 'error', COALESCE(p_error, 'EYAD_JOB_FAILED'))),
    completed_at = now(), claim_token = NULL, lease_until = NULL, updated_at = now()
  WHERE id = p_job_id RETURNING * INTO v_job;

  IF v_cost > 0 THEN
    PERFORM public.refund_eyad_credits(v_job.owner_id, v_cost, 'job', v_job.id,
      'Refund after EYAD job failure: ' || COALESCE(p_error, 'EYAD_JOB_FAILED'), jsonb_build_object('project_id', v_job.project_id));
  END IF;
  RETURN jsonb_build_object('job', to_jsonb(v_job), 'replayed', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_eyad_generation(
  p_job_id uuid,
  p_owner_id uuid,
  p_claim_token uuid,
  p_finalization jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.eyad_jobs%ROWTYPE;
  v_project record;
  v_conversation record;
  v_input jsonb;
  v_asset public.assets%ROWTYPE;
  v_primary_asset public.assets%ROWTYPE;
  v_has_primary_asset boolean := false;
  v_generation public.generations%ROWTYPE;
  v_primary_generation public.generations%ROWTYPE;
  v_message public.messages%ROWTYPE;
  v_images jsonb := '[]'::jsonb;
  v_index integer;
  v_result jsonb;
BEGIN
  SELECT * INTO v_job FROM public.eyad_jobs
  WHERE id = p_job_id AND owner_id = p_owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'JOB_NOT_FOUND'; END IF;
  IF v_job.status = 'completed' THEN RETURN COALESCE(v_job.result, '{}'::jsonb); END IF;
  IF v_job.status <> 'processing' OR v_job.claim_token IS DISTINCT FROM p_claim_token
     OR COALESCE(v_job.lease_until <= now(), true) THEN
    RAISE EXCEPTION 'JOB_CLAIM_LOST';
  END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = v_job.project_id AND owner_id = p_owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_OR_CONVERSATION_NOT_FOUND'; END IF;
  SELECT * INTO v_conversation FROM public.conversations WHERE id = v_job.conversation_id AND owner_id = p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_OR_CONVERSATION_NOT_FOUND'; END IF;
  IF p_finalization->'assets' IS NULL OR jsonb_typeof(p_finalization->'assets') <> 'array'
     OR jsonb_array_length(p_finalization->'assets') = 0 THEN
    RAISE EXCEPTION 'FINALIZATION_ASSETS_REQUIRED';
  END IF;

  FOR v_input IN SELECT value FROM jsonb_array_elements(p_finalization->'assets') LOOP
    v_index := (v_input->>'variant_index')::integer;
    IF v_index IS NULL OR v_index < 1 THEN RAISE EXCEPTION 'INVALID_VARIANT_INDEX'; END IF;
    IF NULLIF(v_input->>'storage_path', '') IS NULL THEN RAISE EXCEPTION 'FINALIZATION_STORAGE_PATH_REQUIRED'; END IF;

    INSERT INTO public.assets(owner_id, project_id, kind, name, storage_path, mime_type, size_bytes, metadata, job_id)
    VALUES (p_owner_id, v_job.project_id, v_input->>'kind', v_input->>'name', v_input->>'storage_path',
      'image/png', (v_input->>'size_bytes')::bigint, COALESCE(v_input->'metadata', '{}'::jsonb), v_job.id)
    ON CONFLICT (job_id, storage_path) WHERE job_id IS NOT NULL AND storage_path IS NOT NULL DO NOTHING;
    SELECT * INTO v_asset FROM public.assets WHERE job_id = v_job.id AND storage_path = v_input->>'storage_path';
    IF NOT v_has_primary_asset THEN
      v_primary_asset := v_asset;
      v_has_primary_asset := true;
    END IF;

    INSERT INTO public.generations(owner_id, project_id, studio_type, provider, model, prompt, input, output, status, credit_cost, completed_at, job_id, variant_index)
    VALUES (p_owner_id, v_job.project_id, p_finalization->>'studio_id', 'openai', 'gpt-image-2',
      COALESCE(v_input->>'prompt', ''), COALESCE(v_input->'input', '{}'::jsonb),
      jsonb_build_object('type','image','mime_type','image/png','asset_id',v_asset.id,'storage_path',v_asset.storage_path,'asset_url',v_input->>'asset_url'),
      'completed', COALESCE((v_job.payload->>'credit_cost')::numeric, 0) /
        GREATEST(1, jsonb_array_length(p_finalization->'assets')), now(), v_job.id, v_index)
    ON CONFLICT (job_id, variant_index) WHERE job_id IS NOT NULL AND variant_index IS NOT NULL DO NOTHING;
    SELECT * INTO v_generation FROM public.generations WHERE job_id = v_job.id AND variant_index = v_index;
    UPDATE public.assets SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('generation_id', v_generation.id)
      WHERE id = v_asset.id;

    v_images := v_images || jsonb_build_array(jsonb_build_object(
      'data_url', v_input->>'asset_url', 'format', 'png', 'asset_id', v_asset.id, 'storage_path', v_asset.storage_path
    ));
  END LOOP;

  v_asset := v_primary_asset;
  SELECT * INTO v_primary_generation FROM public.generations WHERE job_id = v_job.id ORDER BY variant_index LIMIT 1;
  INSERT INTO public.messages(conversation_id, owner_id, role, content, parts, model, credit_cost, metadata, job_id)
  VALUES (v_job.conversation_id, p_owner_id, 'assistant', p_finalization->>'reply',
    jsonb_build_array(jsonb_build_object('type','image','mime_type','image/png','asset_id',v_asset.id)),
    'gpt-image-2', COALESCE((v_job.payload->>'credit_cost')::numeric, 0),
    COALESCE(p_finalization->'message_metadata', '{}'::jsonb) || jsonb_build_object(
      'asset_id',v_asset.id,'asset_url',p_finalization->>'primary_asset_url','storage_path',v_asset.storage_path,'images',v_images
    ), v_job.id)
  ON CONFLICT (job_id, role) WHERE job_id IS NOT NULL DO NOTHING;
  SELECT * INTO v_message FROM public.messages WHERE job_id = v_job.id AND role = 'assistant';

  UPDATE public.projects SET status = 'completed',
    studio_type = COALESCE(p_finalization->>'studio_id', v_project.studio_type),
    metadata = COALESCE(v_project.metadata, '{}'::jsonb) || jsonb_build_object(
      'latest_asset_id',v_asset.id,'latest_asset_name',v_asset.name,'latest_asset_url',p_finalization->>'primary_asset_url',
      'latest_generation_id',v_primary_generation.id,
      'last_studio_id',COALESCE(p_finalization->>'studio_id',v_project.studio_type)
    ), updated_at = now()
  WHERE id = v_project.id AND owner_id = p_owner_id;

  v_result := jsonb_build_object('ok',true,'status','generated','job_id',v_job.id,
    'project',jsonb_build_object('id',v_project.id,'studio_type',p_finalization->>'studio_id','status','completed','latest_asset_id',v_asset.id),
    'conversation',jsonb_build_object('id',v_conversation.id),'reply',p_finalization->>'reply','images',v_images,
    'choices','[]'::jsonb,'creative_actions',COALESCE(p_finalization->'creative_actions','[]'::jsonb),'message_id',v_job.message_id);

  UPDATE public.eyad_jobs SET status = 'completed', result = v_result, error = NULL,
    completed_at = now(), claim_token = NULL, lease_until = NULL, updated_at = now()
  WHERE id = v_job.id;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_expired_eyad_jobs(p_limit integer DEFAULT 50)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.eyad_jobs%ROWTYPE;
  v_cost numeric;
  v_count integer := 0;
  v_error text;
BEGIN
  FOR v_job IN
    SELECT * FROM public.eyad_jobs
    WHERE status IN ('queued', 'processing')
      AND (lease_until IS NULL OR lease_until <= now())
      AND COALESCE((result->>'mockup_started_at')::timestamptz, started_at, created_at) +
        CASE
          WHEN result->>'status' = 'waiting_external' AND NULLIF(result->>'mockup_type','') IS NOT NULL THEN interval '3 minutes'
          WHEN result->>'status' = 'waiting_external' THEN interval '4 minutes'
          ELSE interval '15 minutes'
        END <= now()
    ORDER BY created_at
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 500))
    FOR UPDATE SKIP LOCKED
  LOOP
    v_error := CASE WHEN NULLIF(v_job.result->>'mockup_type','') IS NOT NULL THEN 'MOCKUP_GENERATION_TIMEOUT'
      WHEN v_job.result->>'status' = 'waiting_external' THEN 'IMAGE_GENERATION_TIMEOUT'
      ELSE 'EYAD_JOB_RECONCILIATION_TIMEOUT' END;
    v_cost := COALESCE((v_job.payload->>'credit_cost')::numeric, 0);
    UPDATE public.eyad_jobs SET status = 'failed', error = v_error,
      result = jsonb_build_object('ok',false,'status','failed','error',v_error,'detail',v_error),
      completed_at = now(), claim_token = NULL, lease_until = NULL, updated_at = now()
    WHERE id = v_job.id;
    IF v_cost > 0 THEN
      PERFORM public.refund_eyad_credits(v_job.owner_id, v_cost, 'job', v_job.id,
        'Refund after EYAD job reconciliation timeout', jsonb_build_object('project_id', v_job.project_id));
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_eyad_job_idempotent(uuid,text,uuid,uuid,text,jsonb,jsonb,numeric,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_eyad_credits(uuid,numeric,text,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_eyad_credits(uuid,numeric,text,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_eyad_job(uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_eyad_job_claim(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_eyad_job(uuid,uuid,text,jsonb,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_eyad_generation(uuid,uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_expired_eyad_jobs(integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_eyad_job_idempotent(uuid,text,uuid,uuid,text,jsonb,jsonb,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_eyad_credits(uuid,numeric,text,uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_eyad_credits(uuid,numeric,text,uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_eyad_job(uuid,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_eyad_job_claim(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_eyad_job(uuid,uuid,text,jsonb,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_eyad_generation(uuid,uuid,uuid,jsonb) TO service_role;

DO $schedule$
DECLARE v_job_id bigint;
BEGIN
  FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'eyad-reconcile-expired-jobs' LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
  PERFORM cron.schedule('eyad-reconcile-expired-jobs', '* * * * *', 'select public.reconcile_expired_eyad_jobs(50);');
END;
$schedule$;
