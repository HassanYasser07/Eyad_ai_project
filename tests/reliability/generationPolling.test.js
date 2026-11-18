import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyPoll, nextPollDelay, pollOnce, isRetryableSubmitError, isTransientErrorMessage, SOFT_TIMEOUT_MS,
} from "../../src/services/generationPolling.js";

test("network error is always transient", () => {
  assert.equal(classifyPoll({ networkError: true }).kind, "transient");
});

test("NETWORK_ERROR / NETWORK_TIMEOUT / OPENAI_RESPONSE_POLL_FAILED are never failures", () => {
  for (const code of ["NETWORK_ERROR", "NETWORK_TIMEOUT", "OPENAI_RESPONSE_POLL_FAILED"]) {
    assert.equal(classifyPoll({ httpStatus: 502, data: { error: code } }).kind, "transient", code);
    assert.equal(classifyPoll({ httpStatus: 400, data: { error: code } }).kind, "transient", code);
  }
});

test("5xx, 429, 408, 401 are transient", () => {
  for (const httpStatus of [500, 502, 503, 504, 429, 408, 401, 403]) {
    assert.equal(classifyPoll({ httpStatus, data: {} }).kind, "transient", String(httpStatus));
  }
});

test("terminal server codes end the job even on 5xx", () => {
  for (const code of ["JOB_FAILED", "MOCKUP_GENERATION_TIMEOUT", "IMAGE_GENERATION_TIMEOUT", "IMAGE_PROVIDER_ERROR", "WORKER_SHUTDOWN"]) {
    assert.equal(classifyPoll({ httpStatus: 502, data: { error: code } }).kind, "failed", code);
  }
  assert.equal(classifyPoll({ httpStatus: 504, data: { error: "MOCKUP_GENERATION_TIMEOUT" } }).error, "MOCKUP_GENERATION_TIMEOUT");
});

test("JOB_NOT_FOUND 404 is terminal", () => {
  assert.equal(classifyPoll({ httpStatus: 404, data: { error: "JOB_NOT_FOUND" } }).kind, "failed");
});

test("generated / completed are done; failed status is failed; others processing", () => {
  assert.equal(classifyPoll({ httpStatus: 200, data: { status: "generated" } }).kind, "done");
  assert.equal(classifyPoll({ httpStatus: 200, data: { status: "completed" } }).kind, "done");
  assert.equal(classifyPoll({ httpStatus: 200, data: { status: "failed", detail: "x" } }).kind, "failed");
  for (const status of ["processing", "queued", "waiting_external"]) {
    assert.equal(classifyPoll({ httpStatus: 200, data: { status } }).kind, "processing", status);
  }
  assert.equal(classifyPoll({ httpStatus: 202, data: { status: "processing" } }).kind, "processing");
});

test("unknown 4xx with a code is a definitive failure; without code transient", () => {
  assert.equal(classifyPoll({ httpStatus: 400, data: { error: "BAD_REQUEST_X" } }).kind, "failed");
  assert.equal(classifyPoll({ httpStatus: 400, data: {} }).kind, "transient");
});

test("backoff schedule grows, caps at 15s, and background polling is never faster than 15s", () => {
  const seq = [0, 1, 2, 3, 4, 5, 6, 50].map((n) => nextPollDelay(n));
  assert.deepEqual(seq, [2500, 2500, 5000, 5000, 10000, 15000, 15000, 15000]);
  assert.equal(nextPollDelay(0, { visible: false }), 15000);
  assert.equal(nextPollDelay(-3), 2500);
  assert.equal(nextPollDelay(undefined), 2500);
});

test("pollOnce converts thrown errors into transient", async () => {
  const r = await pollOnce({ jobId: "j" }, async () => { throw new Error("boom"); });
  assert.equal(r.kind, "transient");
  const r2 = await pollOnce({ jobId: "j" }, async () => ({ httpStatus: 200, data: { status: "generated" } }));
  assert.equal(r2.kind, "done");
  const r3 = await pollOnce({ jobId: "j" }, async () => null);
  assert.equal(r3.kind, "transient");
});

test("submit error retryability", () => {
  assert.ok(isRetryableSubmitError({ retryable: true }));
  assert.ok(isRetryableSubmitError(new Error("NETWORK_ERROR")));
  assert.ok(isRetryableSubmitError(new Error("HTTP_503")));
  assert.ok(!isRetryableSubmitError(new Error("INSUFFICIENT_CREDITS")));
  assert.ok(isTransientErrorMessage("OPENAI_RESPONSE_POLL_FAILED: x"));
});

test("soft timeout is a hint only (4 minutes)", () => {
  assert.equal(SOFT_TIMEOUT_MS, 240000);
});
