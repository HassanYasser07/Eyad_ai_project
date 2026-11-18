import test from "node:test";
import assert from "node:assert/strict";
import {
  getGenerationRequestId, rememberGenerationRequestJob, clearGenerationRequestForJob, clearGenerationRequest,
} from "../../src/services/idempotency.js";

function storage() {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: (i) => Array.from(m.keys())[i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
const crypto = globalThis.crypto;
const req = { message: "letterhead", studioId: "brand-kit", designOptions: { mockup_type: "letterhead" } };

test("same request reuses the same key while the job is active (no double charge)", async () => {
  const s = storage();
  const k1 = await getGenerationRequestId(req, s, crypto);
  await rememberGenerationRequestJob(req, "job-1", s, crypto);
  const k2 = await getGenerationRequestId(req, s, crypto);
  assert.equal(k1, k2);
});

test("a different request gets a different key", async () => {
  const s = storage();
  const k1 = await getGenerationRequestId(req, s, crypto);
  const k2 = await getGenerationRequestId({ ...req, message: "other" }, s, crypto);
  assert.notEqual(k1, k2);
});

test("after the job is terminal, clearing by job id gives a fresh key (regenerate = new job)", async () => {
  const s = storage();
  const k1 = await getGenerationRequestId(req, s, crypto);
  await rememberGenerationRequestJob(req, "job-1", s, crypto);
  clearGenerationRequestForJob("job-1", s);
  const k2 = await getGenerationRequestId(req, s, crypto);
  assert.notEqual(k1, k2);
});

test("clearing another job id does not touch an active request", async () => {
  const s = storage();
  const k1 = await getGenerationRequestId(req, s, crypto);
  await rememberGenerationRequestJob(req, "job-1", s, crypto);
  clearGenerationRequestForJob("job-2", s);
  assert.equal(await getGenerationRequestId(req, s, crypto), k1);
});

test("clearGenerationRequest by request gives a fresh key; broken storage never throws", async () => {
  const s = storage();
  const k1 = await getGenerationRequestId(req, s, crypto);
  await clearGenerationRequest(req, s, crypto);
  assert.notEqual(await getGenerationRequestId(req, s, crypto), k1);
  const broken = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); }, length: 0, key() { return null; } };
  assert.match(await getGenerationRequestId(req, broken, crypto), /^[0-9a-f-]{36}$/);
});
