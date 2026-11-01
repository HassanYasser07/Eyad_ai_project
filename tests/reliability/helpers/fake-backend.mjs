import { randomUUID } from "node:crypto";

/** Minimal in-memory stand-in for the parts of supabase-js used by the Edge Function. */
export function createFakeBackend({ users = {} } = {}) {
  const tables = { projects: [], gamma_presentation_jobs: [] };

  class Query {
    constructor(table) { this.table = table; this.mode = "select"; this.filters = []; this.payload = null; this.opts = {}; }
    select(_cols, opts = {}) { this.opts = { ...this.opts, ...opts }; return this; }
    insert(row) { this.mode = "insert"; this.payload = row; return this; }
    update(patch) { this.mode = "update"; this.payload = patch; return this; }
    eq(k, v) { this.filters.push((r) => r[k] === v); return this; }
    gte(k, v) { this.filters.push((r) => r[k] >= v); return this; }
    _run() {
      const rows = tables[this.table];
      if (this.mode === "insert") {
        const row = { id: randomUUID(), status: "pending", generation_id: null, gamma_url: null, export_url: null, error_code: null, error_message: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...this.payload };
        rows.push(row);
        return [row];
      }
      const matched = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.mode === "update") matched.forEach((r) => Object.assign(r, this.payload));
      return matched;
    }
    async maybeSingle() { const out = this._run(); return { data: out[0] || null, error: null }; }
    async single() { const out = this._run(); return out[0] ? { data: out[0], error: null } : { data: null, error: { code: "PGRST116" } }; }
    then(resolve, reject) {
      const out = this._run();
      const result = this.opts.head ? { data: null, count: out.length, error: null } : { data: out, error: null };
      return Promise.resolve(result).then(resolve, reject);
    }
  }

  const createClient = (_url, _key, options = {}) => ({
    auth: {
      async getUser(token) {
        const user = users[token];
        return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "invalid" } };
      },
    },
    from: (table) => new Query(table),
    _options: options,
  });
  return { tables, createClient };
}

/** Scripted stand-in for https://public-api.gamma.app/v1.0 */
export function createFakeGamma({ pollSequence = ["pending", "pending", "completed"], createStatus = 200, rejectThemeOnce = false } = {}) {
  const calls = [];
  let polls = 0;
  let themeRejected = false;
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const fetchImpl = async (url, init = {}) => {
    const href = String(url);
    const record = { method: init.method || "GET", url: href, headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null };
    calls.push(record);
    if (!href.startsWith("https://public-api.gamma.app/v1.0")) return reply(599, { message: "unexpected host" });
    if (record.method === "POST" && href.endsWith("/generations")) {
      if (rejectThemeOnce && record.body.themeId && !themeRejected) { themeRejected = true; return reply(422, { message: "Unknown themeId" }); }
      if (createStatus !== 200) return reply(createStatus, { message: "create failed" });
      return reply(200, { generationId: "gen_123" });
    }
    if (record.method === "GET" && /\/generations\/gen_123$/.test(href)) {
      const state = pollSequence[Math.min(polls, pollSequence.length - 1)];
      polls += 1;
      if (state === "completed") return reply(200, { generationId: "gen_123", status: "completed", gammaUrl: "https://gamma.app/docs/real-deck", credits: { deducted: 40 } });
      if (state === "completed-no-url") return reply(200, { generationId: "gen_123", status: "completed" });
      if (state === "failed") return reply(200, { generationId: "gen_123", status: "failed", error: { message: "Generation failed upstream" } });
      if (state === "error-500") return reply(500, { message: "boom" });
      return reply(200, { generationId: "gen_123", status: "pending" });
    }
    return reply(404, { message: "not found" });
  };
  return { calls, fetchImpl };
}
