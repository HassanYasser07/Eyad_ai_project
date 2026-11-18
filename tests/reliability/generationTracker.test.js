import test from "node:test";
import assert from "node:assert/strict";
import {
  trackJob, updateJob, getJob, getActiveJobs, saveResult, getResult, consumeResult,
  removeJob, clearForUser, getAllJobs, isTerminalStatus, __resetTrackerMemory,
} from "../../src/services/generationTracker.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    _data: data,
  };
}

test.beforeEach(() => __resetTrackerMemory());

test("tracks a job and returns it as active", () => {
  const s = memoryStorage();
  trackJob("u1", { jobId: "j1", kind: "mockup", projectId: "p1", requestKey: "rk1" }, s);
  const active = getActiveJobs("u1", s);
  assert.equal(active.length, 1);
  assert.equal(active[0].jobId, "j1");
  assert.equal(active[0].status, "processing");
  assert.equal(active[0].route, "/studios/brand-kit?project=p1");
});

test("persists across a simulated app restart", () => {
  const s = memoryStorage();
  trackJob("u1", { jobId: "j1", kind: "logo" }, s);
  __resetTrackerMemory();
  assert.equal(getJob("u1", "j1", s)?.jobId, "j1");
});

test("is scoped per user", () => {
  const s = memoryStorage();
  trackJob("u1", { jobId: "j1", kind: "image" }, s);
  assert.equal(getActiveJobs("u2", s).length, 0);
  assert.equal(getJob("u2", "j1", s), null);
});

test("a terminal job is never reopened by a later trackJob", () => {
  const s = memoryStorage();
  trackJob("u1", { jobId: "j1", kind: "image" }, s);
  saveResult("u1", "j1", { status: "generated", data: { ok: true } }, s);
  trackJob("u1", { jobId: "j1", kind: "image", status: "processing" }, s);
  assert.equal(getJob("u1", "j1", s).status, "generated");
  assert.equal(getActiveJobs("u1", s).length, 0);
});

test("saveResult / getResult / consumeResult lifecycle", () => {
  const s = memoryStorage();
  trackJob("u1", { jobId: "j1", kind: "mockup" }, s);
  saveResult("u1", "j1", { status: "generated", data: { image: { url: "https://x/y.png" } } }, s);
  assert.equal(getResult("u1", "j1", s).data.image.url, "https://x/y.png");
  const consumed = consumeResult("u1", "j1", s);
  assert.equal(consumed.status, "generated");
  assert.equal(getResult("u1", "j1", s), null);
  assert.equal(getJob("u1", "j1", s), null);
});

test("failed results are kept until consumed", () => {
  const s = memoryStorage();
  trackJob("u1", { jobId: "j1", kind: "mockup" }, s);
  saveResult("u1", "j1", { status: "failed", error: "JOB_FAILED" }, s);
  assert.equal(getResult("u1", "j1", s).error, "JOB_FAILED");
  assert.equal(getAllJobs("u1", s)[0].result.status, "failed");
});

test("prunes expired results and stale active jobs", () => {
  const s = memoryStorage();
  const old = Date.now() - 25 * 60 * 60 * 1000;
  const stale = Date.now() - 7 * 60 * 60 * 1000;
  const key = "eyad.active-generations.v2:u1";
  s.setItem(key, JSON.stringify({
    version: 2,
    jobs: {
      a: { jobId: "a", status: "generated", createdAt: old },
      b: { jobId: "b", status: "processing", createdAt: stale },
    },
    results: { a: { status: "generated", finishedAt: old, consumed: false } },
  }));
  trackJob("u1", { jobId: "c", kind: "logo" }, s);
  const ids = getAllJobs("u1", s).map((j) => j.jobId);
  assert.deepEqual(ids, ["c"]);
});

test("malformed JSON and wrong version are treated as empty", () => {
  const key = "eyad.active-generations.v2:u1";
  const s1 = memoryStorage({ [key]: "{not json" });
  assert.equal(getActiveJobs("u1", s1).length, 0);
  const s2 = memoryStorage({ [key]: JSON.stringify({ version: 1, jobs: { x: {} } }) });
  assert.equal(getActiveJobs("u1", s2).length, 0);
  const s3 = memoryStorage({ [key]: JSON.stringify({ version: 2, jobs: [], results: "x" }) });
  assert.equal(getActiveJobs("u1", s3).length, 0);
});

test("quota failure on setItem does not throw and the session keeps working", () => {
  const s = memoryStorage();
  s.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.doesNotThrow(() => trackJob("u1", { jobId: "j1", kind: "image" }, s));
  assert.doesNotThrow(() => saveResult("u1", "j1", { status: "generated" }, s));
});

test("updateJob patches only existing jobs; removeJob and clearForUser delete", () => {
  const s = memoryStorage();
  assert.equal(updateJob("u1", "nope", { attempts: 1 }, s), null);
  trackJob("u1", { jobId: "j1", kind: "image" }, s);
  assert.equal(updateJob("u1", "j1", { attempts: 3 }, s).attempts, 3);
  removeJob("u1", "j1", s);
  assert.equal(getJob("u1", "j1", s), null);
  trackJob("u1", { jobId: "j2", kind: "image" }, s);
  clearForUser("u1", s);
  assert.equal(getActiveJobs("u1", s).length, 0);
});

test("trackJob without jobId is ignored; isTerminalStatus", () => {
  const s = memoryStorage();
  assert.equal(trackJob("u1", {}, s), null);
  assert.ok(isTerminalStatus("generated") && isTerminalStatus("completed") && isTerminalStatus("failed"));
  assert.ok(!isTerminalStatus("processing") && !isTerminalStatus("queued"));
});
