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

const TEMPLATE_ID = "44444444-4444-4444-8444-444444444444";
const GAMMA_TEMPLATE_ID = "55555555-5555-4555-8555-555555555555";
const settings = (o = {}) => ({ topic: "Solar energy for schools", detail: "standard", slideCount: "10", language: "ar", ...o });

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
    assert.equal(created.json.job.template_mode, "none");

    const post = fakeGamma.calls.find((c) => c.method === "POST");
    assert.equal(post.url, "https://public-api.gamma.app/v1.0/generations");
    assert.equal(post.headers["X-API-KEY"], SECRET);
    assert.equal(post.body.inputText, "Solar energy for schools");
    assert.equal(post.body.numCards, 10);
    assert.equal(post.body.textOptions.language, "ar");
    assert.equal(post.body.textOptions.amount, "medium");
    assert.equal(post.body.format, "presentation");

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
    assert.equal(saved.detail, "standard"); assert.equal(saved.language, "ar"); assert.equal(saved.slideCount, "10"); assert.equal(saved.templateId, null);
  } finally { teardown(); }
});

test("an attached file is sent to Gamma as source text, but only its name and size are stored", async () => {
  const { backend, fakeGamma } = await setup();
  try {
    const res = await start({ settings: settings({ fileName: "notes.docx", fileText: "UNIQUE-FILE-BODY about panels" }) });
    assert.equal(res.status, 200);
    const post = fakeGamma.calls.find((c) => c.method === "POST");
    assert.match(post.body.inputText, /UNIQUE-FILE-BODY about panels/);
    assert.match(post.body.inputText, /notes\.docx/);
    const saved = backend.tables.gamma_presentation_jobs[0].settings;
    assert.equal(saved.fileName, "notes.docx");
    assert.equal(saved.fileChars, "UNIQUE-FILE-BODY about panels".length);
    assert.ok(!JSON.stringify(saved).includes("UNIQUE-FILE-BODY"));
  } finally { teardown(); }
});

test("Language Auto detects Arabic text; Pages Auto sends no numCards", async () => {
  const { fakeGamma } = await setup();
  try {
    await start({ settings: settings({ topic: "مقدمة في الطاقة الشمسية", language: "auto", slideCount: "auto" }) });
    const post = fakeGamma.calls.find((c) => c.method === "POST");
    assert.equal(post.body.textOptions.language, "ar");
    assert.equal("numCards" in post.body, false);
  } finally { teardown(); }
});

test("a template with a Gamma template id calls from-template; ids come from the database, never the browser", async () => {
  const { backend, fakeGamma } = await setup();
  backend.tables.presentation_templates.push({ id: TEMPLATE_ID, is_active: true, gamma_template_id: GAMMA_TEMPLATE_ID, gamma_theme_id: "theme_t", style_prompt: "bold", title_en: "T" });
  try {
    const res = await start({ template_id: TEMPLATE_ID, settings: { ...settings(), gamma_template_id: "EVIL", gammaId: "EVIL" } });
    assert.equal(res.status, 200);
    assert.equal(res.json.job.template_mode, "gamma-template");
    const post = fakeGamma.calls.find((c) => c.method === "POST");
    assert.equal(post.url, "https://public-api.gamma.app/v1.0/generations/from-template");
    assert.equal(post.body.gammaId, GAMMA_TEMPLATE_ID);
    assert.equal(post.body.themeId, "theme_t");
    assert.match(post.body.prompt, /Solar energy for schools/);
    assert.ok(!JSON.stringify(post.body).includes("EVIL"));
    assert.equal(backend.tables.gamma_presentation_jobs[0].settings.templateId, TEMPLATE_ID);
  } finally { teardown(); }
});

test("a style-only template applies its design direction; unknown, inactive or malformed templates are rejected before Gamma", async () => {
  const { backend, fakeGamma } = await setup();
  backend.tables.presentation_templates.push(
    { id: TEMPLATE_ID, is_active: true, style_prompt: "Template style: dark navy." },
    { id: "66666666-6666-4666-8666-666666666666", is_active: false, style_prompt: "hidden" },
  );
  try {
    const ok = await start({ template_id: TEMPLATE_ID });
    assert.equal(ok.status, 200);
    const post = fakeGamma.calls.find((c) => c.method === "POST");
    assert.equal(post.url, "https://public-api.gamma.app/v1.0/generations");
    assert.match(post.body.additionalInstructions, /dark navy/);
    const before = fakeGamma.calls.length;
    assert.equal((await start({ request_id: "req-missing-tpl-1", template_id: "77777777-7777-4777-8777-777777777777" })).json.error, "TEMPLATE_NOT_FOUND");
    assert.equal((await start({ request_id: "req-inactive-tpl-1", template_id: "66666666-6666-4666-8666-666666666666" })).json.error, "TEMPLATE_NOT_FOUND");
    assert.equal((await start({ request_id: "req-badid-tpl-0001", template_id: "not-a-uuid" })).json.error, "INVALID_TEMPLATE_ID");
    assert.equal(fakeGamma.calls.length, before);
  } finally { teardown(); }
});

test("a rejected template theme retries once without it", async () => {
  const rejected = await setup({ gamma: { rejectThemeOnce: true } });
  rejected.backend.tables.presentation_templates.push({ id: TEMPLATE_ID, is_active: true, gamma_theme_id: "bad_theme" });
  try {
    const res = await start({ template_id: TEMPLATE_ID });
    assert.equal(res.status, 200);
    const posts = rejected.fakeGamma.calls.filter((c) => c.method === "POST");
    assert.equal(posts.length, 2);
    assert.equal(posts[0].body.themeId, "bad_theme");
    assert.equal("themeId" in posts[1].body, false);
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
    const res = await start({ settings: settings({ topic: "", language: "klingon", slideCount: "7" }) });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, "VALIDATION_FAILED");
    assert.equal(res.json.fields.topic, "REQUIRED");
    assert.equal(res.json.fields.language, "UNSUPPORTED_LANGUAGE");
    assert.equal(res.json.fields.slideCount, "INVALID");
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
