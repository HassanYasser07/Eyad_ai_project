import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { createFakeBackend, createFakeGamma } from "./helpers/fake-backend.mjs";

register("./helpers/edge-loader.mjs", import.meta.url);

const SECRET = "sk-gamma-SUPER-SECRET-123";
const USER = { id: "11111111-1111-4111-8111-111111111111", is_anonymous: false };
const OTHER = { id: "22222222-2222-4222-8222-222222222222", is_anonymous: false };
const GUEST = { id: "33333333-3333-4333-8333-333333333333", is_anonymous: true };
const users = { "tok-user": USER, "tok-other": OTHER, "tok-guest": GUEST };

const realFetch = globalThis.fetch;
let handler;
let env;
let logged;

globalThis.Deno = { env: { get: (key) => env[key] }, serve: (fn) => { handler = fn; } };
const originalConsole = { error: console.error, log: console.log, warn: console.warn };

async function setup({ gamma = {}, envOverrides = {} } = {}) {
  env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_PUBLISHABLE_KEY: "pub", SUPABASE_SERVICE_ROLE_KEY: "svc", GAMMA_API_KEY: SECRET, ...envOverrides };
  const backend = createFakeBackend({ users });
  globalThis.__createClient = backend.createClient;
  const fakeGamma = createFakeGamma(gamma);
  globalThis.fetch = fakeGamma.fetchImpl;
  logged = [];
  for (const level of ["error", "log", "warn"]) console[level] = (...args) => logged.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  if (!handler) await import("../../supabase/functions/eyad-presentation/index.ts");
  return { backend, fakeGamma };
}
function teardown() {
  globalThis.fetch = realFetch;
  Object.assign(console, originalConsole);
}

const colorPackage = { id: "ocean-blue", name: "Ocean Blue", colors: ["#16324F", "#245C73", "#64B6AC", "#F4F7F5"] };
const settings = (o = {}) => ({ topic: "Solar energy for schools", purpose: "educational", audience: "students", customAudience: "", slideCount: "10", language: "ar", otherLanguage: "", additionalInstructions: "Use real examples", colorPackage, ...o });

async function call(body, token = "tok-user") {
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const res = await handler(new Request("https://fn.local/eyad-presentation", { method: "POST", headers, body: JSON.stringify(body) }));
  return { status: res.status, text: await res.clone().text(), json: await res.json() };
}
const start = (extra = {}, token) => call({ action: "start", request_id: "req-abcdefgh-1", settings: settings(), ...extra }, token);

test("start -> poll -> completed: real Gamma request, real result link, key stays server-side", async () => {
  const { backend, fakeGamma } = await setup();
  try {
    const created = await start();
    assert.equal(created.status, 200);
    assert.equal(created.json.job.status, "pending");
    assert.equal(created.json.job.color_application, "instructions");

    const post = fakeGamma.calls.find((c) => c.method === "POST");
    assert.equal(post.url, "https://public-api.gamma.app/v1.0/generations");
    assert.equal(post.headers["X-API-KEY"], SECRET);
    assert.equal(post.body.inputText, "Solar energy for schools");
    assert.equal(post.body.numCards, 10);
    assert.equal(post.body.textOptions.language, "ar");
    assert.equal(post.body.format, "presentation");
    assert.match(post.body.additionalInstructions, /Use real examples/);
    assert.match(post.body.additionalInstructions, /#16324F/i);

    const jobId = created.json.job.id;
    const first = await call({ action: "status", job_id: jobId });
    assert.equal(first.json.job.status, "pending");
    assert.equal(first.json.job.gamma_url, null);
    await call({ action: "status", job_id: jobId });
    const done = await call({ action: "status", job_id: jobId });
    assert.equal(done.json.job.status, "completed");
    assert.equal(done.json.job.gamma_url, "https://gamma.app/docs/real-deck");
    assert.equal(backend.tables.gamma_presentation_jobs[0].status, "completed");

    // Terminal jobs are served from the database without calling Gamma again.
    const gammaGets = fakeGamma.calls.filter((c) => c.method === "GET").length;
    await call({ action: "status", job_id: jobId });
    assert.equal(fakeGamma.calls.filter((c) => c.method === "GET").length, gammaGets);

    // The secret never reaches a response or a log line.
    assert.ok(![created.text, first.text, done.text, ...logged].some((s) => s.includes(SECRET)));
    // Saved settings include every user choice.
    const saved = backend.tables.gamma_presentation_jobs[0].settings;
    assert.equal(saved.purpose, "educational"); assert.equal(saved.language, "ar"); assert.equal(saved.slideCount, "10"); assert.equal(saved.colorPackage.id, "ocean-blue");
  } finally { teardown(); }
});

test("a configured Gamma theme is applied via themeId; a rejected theme retries once with palette guidance", async () => {
  const { fakeGamma } = await setup({ envOverrides: { GAMMA_THEME_IDS: JSON.stringify({ "ocean-blue": "theme_ocean" }) } });
  try {
    const ok = await start({ request_id: "req-theme-ok-1" });
    assert.equal(ok.json.job.color_application, "theme");
    assert.equal(fakeGamma.calls.find((c) => c.method === "POST").body.themeId, "theme_ocean");
  } finally { teardown(); }

  const rejected = await setup({ gamma: { rejectThemeOnce: true }, envOverrides: { GAMMA_THEME_IDS: JSON.stringify({ "ocean-blue": "bad_theme" }) } });
  try {
    const res = await start({ request_id: "req-theme-bad-1" });
    assert.equal(res.status, 200);
    const posts = rejected.fakeGamma.calls.filter((c) => c.method === "POST");
    assert.equal(posts.length, 2);
    assert.equal("themeId" in posts[1].body, false);
    assert.equal(res.json.job.color_application, "instructions");
    assert.equal(res.json.job.theme_rejected, true);
  } finally { teardown(); }
});

test("same request id never creates a second Gamma generation", async () => {
  const { fakeGamma, backend } = await setup();
  try {
    const a = await start();
    const b = await start();
    assert.equal(a.json.job.id, b.json.job.id);
    assert.equal(b.json.reused, true);
    assert.equal(fakeGamma.calls.filter((c) => c.method === "POST").length, 1);
    assert.equal(backend.tables.gamma_presentation_jobs.length, 1);
  } finally { teardown(); }
});

test("guests, missing sessions and missing key are rejected before any Gamma call", async () => {
  const { fakeGamma } = await setup();
  try {
    assert.equal((await start({}, "tok-guest")).json.error, "ACCOUNT_REQUIRED");
    assert.equal((await start({}, null)).status, 401);
    assert.equal((await start({}, "tok-nobody")).json.error, "INVALID_SESSION");
    assert.equal(fakeGamma.calls.length, 0);
  } finally { teardown(); }
  await setup({ envOverrides: { GAMMA_API_KEY: "" } });
  try {
    const res = await start();
    assert.equal(res.status, 503);
    assert.equal(res.json.error, "GAMMA_API_KEY_MISSING");
  } finally { teardown(); }
});

test("users cannot read each other's jobs", async () => {
  await setup();
  try {
    const created = await start();
    const stolen = await call({ action: "status", job_id: created.json.job.id }, "tok-other");
    assert.equal(stolen.status, 404);
  } finally { teardown(); }
});

test("invalid form data is rejected with per-field codes and no Gamma call", async () => {
  const { fakeGamma } = await setup();
  try {
    const res = await start({ settings: settings({ topic: "", language: "other", otherLanguage: "Klingon" }) });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, "VALIDATION_FAILED");
    assert.equal(res.json.fields.topic, "REQUIRED");
    assert.equal(res.json.fields.otherLanguage, "UNSUPPORTED_LANGUAGE");
    assert.equal(fakeGamma.calls.length, 0);
  } finally { teardown(); }
});

test("Gamma errors surface as clear codes and the job is marked failed", async () => {
  const { backend } = await setup({ gamma: { createStatus: 401 } });
  try {
    const res = await start();
    assert.equal(res.json.error, "GAMMA_AUTH_FAILED");
    assert.equal(backend.tables.gamma_presentation_jobs[0].status, "failed");
    assert.ok(!res.text.includes(SECRET));
  } finally { teardown(); }
});

test("a 'completed' status without a presentation link is NOT reported as success", async () => {
  await setup({ gamma: { pollSequence: ["completed-no-url"] } });
  try {
    const created = await start();
    const result = await call({ action: "status", job_id: created.json.job.id });
    assert.equal(result.json.job.status, "failed");
    assert.equal(result.json.job.gamma_url, null);
  } finally { teardown(); }
});

test("upstream failure is reported as failed; transient poll errors keep the job pending", async () => {
  await setup({ gamma: { pollSequence: ["failed"] } });
  try {
    const created = await start();
    const result = await call({ action: "status", job_id: created.json.job.id });
    assert.equal(result.json.job.status, "failed");
    assert.match(result.json.job.error_message, /upstream/);
  } finally { teardown(); }
  const { backend } = await setup({ gamma: { pollSequence: ["error-500", "completed"] } });
  try {
    const created = await start();
    const hiccup = await call({ action: "status", job_id: created.json.job.id });
    assert.equal(hiccup.status, 502);
    assert.equal(hiccup.json.retryable, true);
    assert.equal(backend.tables.gamma_presentation_jobs[0].status, "pending");
    const recovered = await call({ action: "status", job_id: created.json.job.id });
    assert.equal(recovered.json.job.status, "completed");
  } finally { teardown(); }
});

test("a user cannot run more than two generations at once", async () => {
  await setup();
  try {
    assert.equal((await start({ request_id: "req-limit-0001" })).status, 200);
    assert.equal((await start({ request_id: "req-limit-0002" })).status, 200);
    const third = await start({ request_id: "req-limit-0003" });
    assert.equal(third.status, 429);
    assert.equal(third.json.error, "TOO_MANY_ACTIVE_JOBS");
  } finally { teardown(); }
});
