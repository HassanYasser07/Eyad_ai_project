import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { webcrypto } from "node:crypto";
import {
  clearGenerationRequest,
  clearGenerationRequestForJob,
  getGenerationRequestId,
  rememberGenerationRequestJob,
} from "../../src/services/idempotency.js";

class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
  key(index) { return Array.from(this.#values.keys())[index] ?? null; }
}

const request = { action: "generate", message: "A clean black and gold logo", project_id: "project-1" };
const migrationPromise = readFile(new URL("../../supabase/migrations/20260929110000_phase1_generation_reliability.sql", import.meta.url), "utf8");
const edgeSourcePromise = readFile(new URL("../../supabase/functions/eyad-engine/index.ts", import.meta.url), "utf8");
const clientServicePromise = readFile(new URL("../../src/services/eyadEngineService.js", import.meta.url), "utf8");
const jobServicePromise = readFile(new URL("../../src/services/jobService.js", import.meta.url), "utf8");

test("duplicate generation requests reuse the persisted owner request identity", async () => {
  const storage = new MemoryStorage();
  const first = await getGenerationRequestId(request, storage, webcrypto);
  const afterReload = await getGenerationRequestId({ ...request }, storage, webcrypto);
  assert.equal(afterReload, first);
});

test("simultaneous identical client requests converge on one persisted identity", async () => {
  const storage = new MemoryStorage();
  const ids = await Promise.all(Array.from({ length: 20 }, () => getGenerationRequestId(request, storage, webcrypto)));
  assert.equal(new Set(ids).size, 1);
});

test("different generation payloads receive different request identities", async () => {
  const storage = new MemoryStorage();
  const first = await getGenerationRequestId(request, storage, webcrypto);
  const second = await getGenerationRequestId({ ...request, message: "A red geometric logo" }, storage, webcrypto);
  assert.notEqual(first, second);
});

test("terminal job cleanup allows a new intentional identical generation", async () => {
  const storage = new MemoryStorage();
  const first = await getGenerationRequestId(request, storage, webcrypto);
  await rememberGenerationRequestJob(request, "job-1", storage, webcrypto);
  clearGenerationRequestForJob("job-1", storage);
  const next = await getGenerationRequestId(request, storage, webcrypto);
  assert.notEqual(next, first);
});

test("application request and RPC payloads use the Production request_key contract", async () => {
  const [edge, client, jobs] = await Promise.all([edgeSourcePromise, clientServicePromise, jobServicePromise]);
  assert.match(client, /body\.request_key = requestKey/);
  assert.match(edge, /body\?\.request_key/);
  assert.match(edge, /\.eq\("request_key", requestKey\)/);
  assert.match(edge, /p_request_key: requestKey/);
  assert.match(jobs, /action: "poll_generation"[\s\S]*?job_id: jobId/);
});

test("focused SQL contract: duplicate requests lock and uniquely identify one job", async () => {
  const sql = await migrationPromise;
  const create = sql.match(/CREATE OR REPLACE FUNCTION public\.create_eyad_job_idempotent\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/)?.[1] || "";
  assert.match(sql, /UNIQUE INDEX IF NOT EXISTS eyad_jobs_owner_request_key_uidx[\s\S]*?owner_id, request_key/);
  assert.match(create, /pg_advisory_xact_lock/);
  assert.match(create, /WHERE owner_id = p_owner_id AND request_key = p_request_key/);
  assert.match(create, /IF FOUND THEN[\s\S]*?replayed', true/);
  assert.ok(create.indexOf("pg_advisory_xact_lock") < create.indexOf("INSERT INTO public.projects"));
  assert.ok(create.indexOf("IF FOUND THEN") < create.indexOf("INSERT INTO public.projects"));
  assert.ok(create.indexOf("INSERT INTO public.projects") < create.indexOf("INSERT INTO public.conversations"));
  assert.match(create, /_request_project[\s\S]*?_request_conversation/);
  assert.match(create, /v_payload := COALESCE\(p_job_payload[\s\S]*? - '_request_project' - '_request_conversation'/);
});

test("edge failures use the failure RPC and generation records finalize only through Phase 1", async () => {
  const edge = await edgeSourcePromise;
  assert.match(edge, /const failJob = async[\s\S]*?admin\.rpc\("fail_eyad_job"/);
  assert.doesNotMatch(edge, /admin\.from\("eyad_jobs"\)\.update\(\{\s*status:\s*"failed"/);
  assert.doesNotMatch(edge, /admin\.from\("assets"\)\.insert/);
  assert.doesNotMatch(edge, /admin\.from\("generations"\)\.insert/);
});

test("focused SQL contract: simultaneous pollers use a conditional lease claim", async () => {
  const sql = await migrationPromise;
  const claim = sql.match(/CREATE OR REPLACE FUNCTION public\.claim_eyad_job\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/)?.[1] || "";
  assert.match(claim, /UPDATE public\.eyad_jobs/);
  assert.match(claim, /status = 'queued' OR \(status = 'processing'/);
  const claimSignature = sql.match(/CREATE OR REPLACE FUNCTION public\.claim_eyad_job\(([\s\S]*?)\)/)?.[1] || "";
  assert.match(claimSignature, /p_owner_id uuid,[\s\S]*p_job_id uuid,[\s\S]*p_lease_seconds integer DEFAULT 300/);
  assert.match(claim, /lease_until IS NULL OR lease_until < now\(\)/);
  assert.match(claim, /claim_token = v_token/);
  assert.match(claim, /'claimed', false/);
  assert.match(claim, /'claimed', true/);
});

test("focused SQL contract: abandoned claims become reclaimable after the lease", async () => {
  const sql = await migrationPromise;
  assert.match(sql, /lease_until = now\(\) \+ make_interval\(secs => v_seconds\)/);
  assert.match(sql, /lease_until IS NULL OR lease_until < now\(\)/);
});

test("focused SQL contract: duplicate generation finalization is transactional and unique per variant", async () => {
  const sql = await migrationPromise;
  const finalize = sql.match(/CREATE OR REPLACE FUNCTION public\.finalize_eyad_generation\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/)?.[1] || "";
  assert.match(sql, /UNIQUE INDEX IF NOT EXISTS generations_job_variant_uidx[\s\S]*?generations\(job_id, variant_index\)[\s\S]*?WHERE job_id IS NOT NULL AND variant_index IS NOT NULL/);
  assert.match(finalize, /FOR UPDATE/);
  assert.match(finalize, /UPDATE public\.eyad_jobs SET status = 'completed'[\s\S]*?RETURN v_result/);
});

test("focused SQL contract: duplicate asset creation conflicts on durable job and storage path", async () => {
  const sql = await migrationPromise;
  const finalize = sql.match(/CREATE OR REPLACE FUNCTION public\.finalize_eyad_generation\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/)?.[1] || "";
  assert.match(sql, /UNIQUE INDEX IF NOT EXISTS assets_job_storage_uidx[\s\S]*?assets\(job_id, storage_path\)[\s\S]*?WHERE job_id IS NOT NULL AND storage_path IS NOT NULL/);
  assert.match(finalize, /ON CONFLICT \(job_id, storage_path\) WHERE job_id IS NOT NULL AND storage_path IS NOT NULL DO NOTHING/);
  assert.doesNotMatch(sql, /assets\([^)]*variant_index/);
});

test("focused SQL contract: assistant messages are unique per durable job", async () => {
  const sql = await migrationPromise;
  const finalize = sql.match(/CREATE OR REPLACE FUNCTION public\.finalize_eyad_generation\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/)?.[1] || "";
  assert.match(sql, /UNIQUE INDEX IF NOT EXISTS messages_job_role_uidx[\s\S]*?messages\(job_id, role\)[\s\S]*?WHERE job_id IS NOT NULL/);
  assert.match(finalize, /ON CONFLICT \(job_id, role\) WHERE job_id IS NOT NULL DO NOTHING/);
});

test("focused SQL contract: refunds use the shared operation-key registry", async () => {
  const sql = await migrationPromise;
  const refund = sql.match(/CREATE OR REPLACE FUNCTION public\.refund_eyad_credits\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/)?.[1] || "";
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.eyad_credit_operation_keys[\s\S]*?PRIMARY KEY \(operation_type, owner_id, reference_type, reference_id\)/);
  assert.match(sql, /INSERT INTO public\.eyad_credit_operation_keys\(operation_type, owner_id, reference_type, reference_id, amount, created_at\)[\s\S]*?SELECT 'refund'::text AS operation_type/);
  assert.match(sql, /ALTER TABLE public\.eyad_credit_operation_keys ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.eyad_credit_operation_keys FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT ALL PRIVILEGES ON TABLE public\.eyad_credit_operation_keys TO service_role/);
  assert.match(refund, /INSERT INTO public\.eyad_credit_operation_keys\(operation_type, owner_id, reference_type, reference_id, amount\)[\s\S]*?VALUES \('refund', p_owner_id/);
  assert.match(sql, /SELECT DISTINCT ON \(operation_type, owner_id, reference_type, reference_id\)/);
  assert.match(refund, /ON CONFLICT DO NOTHING/);
  assert.match(refund, /WHERE operation_type = 'refund' AND owner_id = p_owner_id/);
  assert.match(refund, /IF v_key_inserted = 0 THEN[\s\S]*?RETURN v_balance/);
});

test("focused SQL contract: scheduled timeout reconciliation locks only eligible rows and refunds", async () => {
  const sql = await migrationPromise;
  const reconcile = sql.match(/CREATE OR REPLACE FUNCTION public\.reconcile_expired_eyad_jobs\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/)?.[1] || "";
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.reconcile_expired_eyad_jobs\(p_limit integer DEFAULT 50\)/);
  assert.match(sql, /cron\.schedule\('eyad-reconcile-expired-jobs', '\* \* \* \* \*', 'select public\.reconcile_expired_eyad_jobs\(50\);'/);
  assert.match(reconcile, /FOR UPDATE SKIP LOCKED/);
  assert.match(reconcile, /lease_until IS NULL OR lease_until <= now\(\)/);
  assert.match(reconcile, /public\.refund_eyad_credits\(v_job\.owner_id, v_cost, 'job', v_job\.id/);
});

test("focused SQL contract: repeated timeout reconciliation skips terminal jobs and refunds", async () => {
  const sql = await migrationPromise;
  const reconcile = sql.match(/CREATE OR REPLACE FUNCTION public\.reconcile_expired_eyad_jobs\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/)?.[1] || "";
  const fail = sql.match(/CREATE OR REPLACE FUNCTION public\.fail_eyad_job\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/)?.[1] || "";
  assert.match(reconcile, /WHERE status IN \('queued', 'processing'\)/);
  assert.match(reconcile, /SET status = 'failed'/);
  assert.match(fail, /IF v_job\.status = 'failed' OR v_job\.status = 'completed' THEN[\s\S]*?replayed', true/);
  assert.match(sql, /PRIMARY KEY \(operation_type, owner_id, reference_type, reference_id\)/);
});

test("focused SQL contract: concurrent credit consumption retains row lock and insufficient balance guard", async () => {
  const sql = await migrationPromise;
  const consume = sql.match(/CREATE OR REPLACE FUNCTION public\.consume_eyad_credits\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/)?.[1] || "";
  assert.match(consume, /FOR UPDATE/);
  assert.match(consume, /COALESCE\(v_balance, 0\) < p_amount/);
  assert.match(consume, /operation_type = 'usage'/);
  assert.match(consume, /RAISE EXCEPTION 'INSUFFICIENT_CREDITS'/);
  assert.doesNotMatch(sql, /credit_transactions_usage_reference_uidx/);
});

test("local baseline contains only pre-Phase-1 schema and keeps Phase 1 separate", async () => {
  const baseline = await readFile(new URL("../../supabase/test/eyad_pre_phase1_test_baseline.sql", import.meta.url), "utf8");
  assert.match(baseline, /CREATE TABLE public\.projects/);
  assert.match(baseline, /CREATE TABLE public\.eyad_jobs/);
  assert.doesNotMatch(baseline, /request_key|claim_token|lease_until|job_id|variant_index|eyad_credit_operation_keys/);
  assert.match(baseline, /REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
  assert.match(baseline, /ENABLE ROW LEVEL SECURITY/);
});
