-- Background generation: server owns the job, client is a resumable observer.
-- 1) Timeout alignment: waiting_external jobs get 5 min, synchronous jobs running inside
--    EdgeRuntime.waitUntil get 8 min (edge max-wait stays 240 s).
-- 2) Owner read policy on eyad_jobs so the client can look up jobs by request_key / list active jobs.
-- 3) Indexes for those lookups.
-- 4) Cron sweeper (pg_net -> eyad-engine reconcile_waiting) so waiting_external jobs are finalized
--    even when no client is polling. Needs Vault secrets (see bottom).

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
          WHEN result->>'status' = 'waiting_external' AND NULLIF(result->>'mockup_type','') IS NOT NULL THEN interval '5 minutes'
          WHEN result->>'status' = 'waiting_external' THEN interval '5 minutes'
          ELSE interval '8 minutes'
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


ALTER TABLE public.eyad_jobs ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'eyad_jobs' AND cmd IN ('SELECT','ALL')
      AND (qual ILIKE '%owner_id%')
  ) THEN
    CREATE POLICY eyad_jobs_owner_select ON public.eyad_jobs FOR SELECT TO authenticated USING (owner_id = auth.uid());
  END IF;
END;
$policy$;

CREATE INDEX IF NOT EXISTS eyad_jobs_owner_request_key_idx ON public.eyad_jobs (owner_id, request_key);
CREATE INDEX IF NOT EXISTS eyad_jobs_owner_active_idx ON public.eyad_jobs (owner_id, created_at DESC)
  WHERE status IN ('queued', 'processing');
CREATE INDEX IF NOT EXISTS eyad_jobs_waiting_external_idx ON public.eyad_jobs (created_at)
  WHERE status = 'processing' AND (result->>'status') = 'waiting_external';

-- Sweeper schedule. Safe to run before the Vault secrets exist: the job simply no-ops until they are created.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_eyad_sweeper(p_function text, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $fn$
DECLARE
  v_url text;
  v_service_key text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'eyad_project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'eyad_service_role_key' LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'eyad_cron_secret' LIMIT 1;
  IF v_url IS NULL OR v_service_key IS NULL OR v_secret IS NULL THEN
    RETURN; -- secrets not configured yet
  END IF;
  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_function,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key,
      'x-eyad-cron-secret', v_secret
    ),
    body := jsonb_build_object('action', p_action),
    timeout_milliseconds := 110000
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.invoke_eyad_sweeper(text, text) FROM PUBLIC, anon, authenticated;

DO $schedule$
DECLARE v_job_id bigint;
BEGIN
  FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname IN ('eyad-reconcile-waiting', 'eyad-reconcile-presentations') LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
  PERFORM cron.schedule('eyad-reconcile-waiting', '* * * * *', $$select public.invoke_eyad_sweeper('eyad-engine', 'reconcile_waiting');$$);
  PERFORM cron.schedule('eyad-reconcile-presentations', '* * * * *', $$select public.invoke_eyad_sweeper('eyad-presentation', 'reconcile_pending');$$);
END;
$schedule$;

-- ---------------------------------------------------------------------------
-- ONE-TIME MANUAL STEPS (SQL editor), replace the values:
--   select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'eyad_project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'eyad_service_role_key');
--   select vault.create_secret('<LONG_RANDOM_STRING>', 'eyad_cron_secret');
-- and set the same random string as a function secret:
--   supabase secrets set EYAD_CRON_SECRET=<LONG_RANDOM_STRING>
-- ---------------------------------------------------------------------------
