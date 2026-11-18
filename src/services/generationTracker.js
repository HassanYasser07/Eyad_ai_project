/**
 * Persistent, per-user store of generation jobs.
 *
 * The server owns every generation job. This store only remembers which jobs the
 * client should keep observing (and their results until a screen consumes them), so
 * that leaving the app, reloading it or killing the WebView never loses a job.
 * Pure JS: no React, storage is injectable for tests, every storage call is guarded.
 */

export const TRACKER_VERSION = 2;
const KEY_PREFIX = "eyad.active-generations.v2:";
const RESULT_TTL_MS = 24 * 60 * 60 * 1000;
const ACTIVE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const TERMINAL = new Set(["generated", "completed", "failed"]);

export const isTerminalStatus = (status) => TERMINAL.has(status);

const listeners = new Set();
let storageListenerAttached = false;
let memoryFallback = new Map();

function getStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function keyFor(userId) {
  return `${KEY_PREFIX}${userId || "anonymous"}`;
}

function emptyState() {
  return { version: TRACKER_VERSION, jobs: {}, results: {} };
}

function sanitize(raw) {
  if (!raw || typeof raw !== "object" || raw.version !== TRACKER_VERSION) return emptyState();
  return {
    version: TRACKER_VERSION,
    jobs: raw.jobs && typeof raw.jobs === "object" && !Array.isArray(raw.jobs) ? raw.jobs : {},
    results: raw.results && typeof raw.results === "object" && !Array.isArray(raw.results) ? raw.results : {},
  };
}

function readState(userId, storage) {
  const store = getStorage(storage);
  if (!store) return sanitize(memoryFallback.get(keyFor(userId)));
  try {
    const text = store.getItem(keyFor(userId));
    return sanitize(text ? JSON.parse(text) : null);
  } catch {
    return emptyState();
  }
}

function prune(state, now = Date.now()) {
  for (const [jobId, result] of Object.entries(state.results)) {
    if (result?.consumed || now - Number(result?.finishedAt || 0) > RESULT_TTL_MS) delete state.results[jobId];
  }
  for (const [jobId, job] of Object.entries(state.jobs)) {
    const age = now - Number(job?.createdAt || 0);
    const hasResult = Boolean(state.results[jobId]);
    if (isTerminalStatus(job?.status) && !hasResult) delete state.jobs[jobId];
    else if (!isTerminalStatus(job?.status) && age > ACTIVE_MAX_AGE_MS) delete state.jobs[jobId];
  }
  return state;
}

function writeState(userId, state, storage) {
  const next = prune(state);
  const store = getStorage(storage);
  memoryFallback.set(keyFor(userId), next);
  if (store) {
    try {
      store.setItem(keyFor(userId), JSON.stringify(next));
    } catch {
      // Quota or privacy mode: the in-memory copy keeps this session working.
    }
  }
  notify(userId);
  return next;
}

function notify(userId) {
  for (const listener of Array.from(listeners)) {
    try { listener(userId); } catch { /* listener errors must not break the tracker */ }
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  if (!storageListenerAttached && typeof window !== "undefined" && window.addEventListener) {
    storageListenerAttached = true;
    window.addEventListener("storage", (event) => {
      if (event?.key && event.key.startsWith(KEY_PREFIX)) notify(event.key.slice(KEY_PREFIX.length));
    });
  }
  return () => listeners.delete(listener);
}

export function defaultRouteFor(kind, projectId) {
  const q = projectId ? `?project=${encodeURIComponent(projectId)}` : "";
  switch (kind) {
    case "mockup":
    case "brand-package":
    case "company-profile":
      return `/studios/brand-kit${q}`;
    case "logo": return `/studios/logo${q}`;
    case "image": return `/studios/ai-images${q}`;
    case "template": return `/studios/templates${q}`;
    case "presentation": return `/studios/presentations${q}`;
    case "video": return `/studios/video${q}`;
    default: return `/chat${q}`;
  }
}

export function trackJob(userId, input, storage) {
  if (!input?.jobId) return null;
  const state = readState(userId, storage);
  const now = Date.now();
  const previous = state.jobs[input.jobId] || {};
  const job = {
    requestKey: null, kind: "chat", studioId: null, projectId: null, context: {}, title: "",
    attempts: 0, softTimeoutShown: false, lastError: null,
    ...previous,
    ...input,
    status: previous.status && isTerminalStatus(previous.status) ? previous.status : (input.status || previous.status || "processing"),
    createdAt: previous.createdAt || input.createdAt || now,
    updatedAt: now,
    lastPolledAt: previous.lastPolledAt || null,
  };
  job.route = input.route || previous.route || defaultRouteFor(job.kind, job.projectId);
  state.jobs[job.jobId] = job;
  writeState(userId, state, storage);
  return job;
}

export function updateJob(userId, jobId, patch, storage) {
  const state = readState(userId, storage);
  if (!state.jobs[jobId]) return null;
  state.jobs[jobId] = { ...state.jobs[jobId], ...patch, updatedAt: Date.now() };
  writeState(userId, state, storage);
  return state.jobs[jobId];
}

export function getJob(userId, jobId, storage) {
  return readState(userId, storage).jobs[jobId] || null;
}

export function getActiveJobs(userId, storage) {
  const state = readState(userId, storage);
  return Object.values(state.jobs)
    .filter((job) => !isTerminalStatus(job.status))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Every tracked job joined with its unconsumed result (newest first). */
export function getAllJobs(userId, storage) {
  const state = readState(userId, storage);
  return Object.values(state.jobs)
    .map((job) => ({ ...job, result: state.results[job.jobId] || null }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function saveResult(userId, jobId, { status, data = null, error = null }, storage) {
  const state = readState(userId, storage);
  const finishedAt = Date.now();
  state.results[jobId] = { status, data, error, finishedAt, consumed: false };
  if (state.jobs[jobId]) state.jobs[jobId] = { ...state.jobs[jobId], status, updatedAt: finishedAt, lastError: null };
  else state.jobs[jobId] = { jobId, kind: "chat", status, createdAt: finishedAt, updatedAt: finishedAt, context: {}, attempts: 0 };
  writeState(userId, state, storage);
  return state.results[jobId];
}

export function getResult(userId, jobId, storage) {
  return readState(userId, storage).results[jobId] || null;
}

export function consumeResult(userId, jobId, storage) {
  const state = readState(userId, storage);
  const result = state.results[jobId] || null;
  if (result) result.consumed = true;
  if (state.jobs[jobId] && isTerminalStatus(state.jobs[jobId].status)) delete state.jobs[jobId];
  writeState(userId, state, storage);
  return result;
}

export function removeJob(userId, jobId, storage) {
  const state = readState(userId, storage);
  delete state.jobs[jobId];
  delete state.results[jobId];
  writeState(userId, state, storage);
}

export function clearForUser(userId, storage) {
  const store = getStorage(storage);
  memoryFallback.delete(keyFor(userId));
  if (store) {
    try { store.removeItem(keyFor(userId)); } catch { /* best effort */ }
  }
  notify(userId);
}

/** Test helper: drop the in-memory mirror. */
export function __resetTrackerMemory() {
  memoryFallback = new Map();
}
