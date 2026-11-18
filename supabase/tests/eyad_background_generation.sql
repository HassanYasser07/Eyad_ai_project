-- Background generation SQL checks. Run after `supabase db push`:
--   psql "$DATABASE_URL" -f supabase/tests/eyad_background_generation.sql
-- Everything runs in a transaction that is rolled back. Raises an exception on the first failed check.
BEGIN;

DO $t$
DECLARE
  v_src text;
  v_count integer;
BEGIN
  -- 1) Timeout alignment: waiting_external = 5 min (both branches), synchronous processing = 8 min.
  SELECT pg_get_functiondef('public.reconcile_expired_eyad_jobs(integer)'::regprocedure) INTO v_src;
  IF v_src NOT LIKE '%WHEN result->>''status'' = ''waiting_external'' AND NULLIF(result->>''mockup_type'','''') IS NOT NULL THEN interval ''5 minutes''%' THEN
    RAISE EXCEPTION 'waiting mockup timeout is not 5 minutes';
  END IF;
  IF v_src NOT LIKE '%ELSE interval ''8 minutes''%' THEN
    RAISE EXCEPTION 'synchronous processing timeout is not 8 minutes';
  END IF;
  IF v_src NOT LIKE '%refund_eyad_credits%' THEN
    RAISE EXCEPTION 'reconcile function no longer refunds credits';
  END IF;

  -- 2) Cron sweepers scheduled exactly once each (idempotent migration).
  SELECT count(*) INTO v_count FROM cron.job WHERE jobname = 'eyad-reconcile-waiting';
  IF v_count <> 1 THEN RAISE EXCEPTION 'eyad-reconcile-waiting scheduled % times', v_count; END IF;
  SELECT count(*) INTO v_count FROM cron.job WHERE jobname = 'eyad-reconcile-presentations';
  IF v_count <> 1 THEN RAISE EXCEPTION 'eyad-reconcile-presentations scheduled % times', v_count; END IF;
  SELECT count(*) INTO v_count FROM cron.job WHERE jobname = 'eyad-reconcile-expired-jobs';
  IF v_count <> 1 THEN RAISE EXCEPTION 'eyad-reconcile-expired-jobs missing or duplicated (%).', v_count; END IF;

  -- 3) Sweeper helper is not callable by clients.
  IF has_function_privilege('authenticated', 'public.invoke_eyad_sweeper(text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.invoke_eyad_sweeper(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'invoke_eyad_sweeper must not be executable by anon/authenticated';
  END IF;

  -- 4) Sweeper is a safe no-op when Vault secrets are not configured (does not raise).
  PERFORM public.invoke_eyad_sweeper('eyad-engine', 'reconcile_waiting');

  -- 5) Owner read policy and indexes exist.
  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'eyad_jobs' AND cmd IN ('SELECT','ALL') AND qual ILIKE '%owner_id%';
  IF v_count < 1 THEN RAISE EXCEPTION 'no owner select policy on eyad_jobs'; END IF;
  SELECT count(*) INTO v_count FROM pg_indexes WHERE schemaname='public' AND tablename='eyad_jobs'
   AND indexname IN ('eyad_jobs_owner_request_key_idx','eyad_jobs_owner_active_idx','eyad_jobs_waiting_external_idx');
  IF v_count <> 3 THEN RAISE EXCEPTION 'expected 3 background-generation indexes, found %', v_count; END IF;
END
$t$;

-- 6) Sweeper idempotence: running the reconciler twice never fails a job twice (second run returns 0
--    for jobs that are already terminal). Uses no fixtures: with nothing expired both calls return 0.
DO $t$
DECLARE a integer; b integer;
BEGIN
  a := public.reconcile_expired_eyad_jobs(50);
  b := public.reconcile_expired_eyad_jobs(50);
  IF b <> 0 THEN RAISE EXCEPTION 'second reconcile run touched % jobs (must be 0)', b; END IF;
END
$t$;

ROLLBACK;
