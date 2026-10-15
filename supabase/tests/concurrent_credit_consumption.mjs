// Integration helper for a disposable local Supabase instance only.
// Required env: EYAD_TEST_SUPABASE_URL, EYAD_TEST_SERVICE_ROLE_KEY,
// EYAD_TEST_USER_ID. The URL is rejected unless it targets localhost.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EYAD_TEST_SUPABASE_URL;
const serviceRoleKey = process.env.EYAD_TEST_SERVICE_ROLE_KEY;
const ownerId = process.env.EYAD_TEST_USER_ID;
assert.ok(url && serviceRoleKey && ownerId, "Set the EYAD_TEST_* variables for a local Supabase test project");
assert.ok(["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname), "Refusing to run a mutating test against a non-local Supabase host");

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const { data: previous, error: readError } = await admin.from("credit_accounts")
  .select("balance,lifetime_credited,lifetime_used,plan").eq("owner_id", ownerId).single();
assert.ifError(readError);

const usageReferences = [randomUUID(), randomUUID()];
const refundReference = randomUUID();
try {
  const { error: resetError } = await admin.from("credit_accounts").update({
    balance: 1,
    lifetime_credited: Math.max(1, previous.lifetime_credited),
    lifetime_used: 0,
  }).eq("owner_id", ownerId);
  assert.ifError(resetError);

  const results = await Promise.all(usageReferences.map((referenceId) => admin.rpc("consume_eyad_credits", {
    p_owner_id: ownerId,
    p_amount: 1,
    p_reference_type: "phase1_concurrency_test",
    p_reference_id: referenceId,
    p_description: "Concurrent credit consumption integration test",
    p_metadata: {},
  })));
  const successful = results.map((result, index) => ({ ...result, referenceId: usageReferences[index] })).filter((result) => !result.error);
  const rejected = results.filter((result) => result.error);
  assert.equal(successful.length, 1, "Exactly one concurrent full-balance debit must succeed");
  assert.equal(rejected.length, 1, "The competing debit must fail rather than overspend");
  const { data: afterConcurrentDebits, error: balanceError } = await admin.from("credit_accounts")
    .select("balance").eq("owner_id", ownerId).single();
  assert.ifError(balanceError);
  assert.equal(Number(afterConcurrentDebits.balance), 0, "Concurrent debits must not leave a negative balance");

  const { error: refundError } = await admin.rpc("refund_eyad_credits", {
    p_owner_id: ownerId,
    p_amount: 1,
    p_reference_type: "phase1_concurrency_test",
    p_reference_id: refundReference,
    p_description: "Restore local concurrency test balance",
    p_metadata: {},
  });
  assert.ifError(refundError);
} finally {
  await admin.from("credit_transactions").delete().in("reference_id", [...usageReferences, refundReference]);
  await admin.from("credit_accounts").update({
    balance: previous.balance,
    lifetime_credited: previous.lifetime_credited,
    lifetime_used: previous.lifetime_used,
    plan: previous.plan,
  }).eq("owner_id", ownerId);
}

console.log("PASS: concurrent credit consumption is serialized; account state restored.");
