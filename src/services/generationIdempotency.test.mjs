import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { clearGenerationIdempotencyKey, getGenerationIdempotencyKey } from "./generationIdempotency.js";

const values = new Map();
globalThis.sessionStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};

afterEach(() => values.clear());

const request = { message: "Create a blue logo", action: "generate", projectId: "project-1", designOptions: { style: "modern" } };

test("duplicate in-flight submissions share a persistent idempotency key", async () => {
  const [first, duplicate] = await Promise.all([
    getGenerationIdempotencyKey(request),
    getGenerationIdempotencyKey(request),
  ]);
  assert.equal(duplicate.key, first.key);
  assert.match(first.key, /^[0-9a-f-]{36}$/i);
});

test("a different logical request gets a different key", async () => {
  const first = await getGenerationIdempotencyKey(request);
  const next = await getGenerationIdempotencyKey({ ...request, message: "Create a red logo" });
  assert.notEqual(next.key, first.key);
});

test("a completed request key can be cleared before intentional regeneration", async () => {
  const first = await getGenerationIdempotencyKey(request);
  clearGenerationIdempotencyKey(first.key);
  const next = await getGenerationIdempotencyKey(request);
  assert.notEqual(next.key, first.key);
});
