const PENDING_GENERATION_KEY = "eyad.pending-generation-request.v1";

function stableRequestValue(request) {
  return JSON.stringify({
    message: request.message || "",
    projectId: request.projectId || null,
    studioId: request.studioId || null,
    language: request.language || "ar",
    action: request.action || "chat",
    designOptions: request.designOptions || {},
    referenceImage: request.referenceImage || null,
    attachments: request.attachments || [],
  });
}

async function fingerprintRequest(request) {
  const value = stableRequestValue(request);
  if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  // This fallback is only used to match a pending browser retry. The server
  // still validates/scopes the independent random UUID idempotency key.
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fallback-${(hash >>> 0).toString(16)}`;
}

export async function getGenerationIdempotencyKey(request) {
  const fingerprint = await fingerprintRequest(request);
  const createKey = () => globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

  try {
    const pending = JSON.parse(globalThis.sessionStorage?.getItem(PENDING_GENERATION_KEY) || "null");
    const requests = Array.isArray(pending?.requests) ? pending.requests : [];
    const existing = requests.find((request) => request?.fingerprint === fingerprint && typeof request.key === "string");
    if (existing) return { key: existing.key, fingerprint };
    const key = createKey();
    requests.push({ key, fingerprint });
    globalThis.sessionStorage?.setItem(PENDING_GENERATION_KEY, JSON.stringify({ requests }));
    return { key, fingerprint };
  } catch {
    return { key: createKey(), fingerprint };
  }
}

export function clearGenerationIdempotencyKey(key) {
  try {
    const pending = JSON.parse(globalThis.sessionStorage?.getItem(PENDING_GENERATION_KEY) || "null");
    const requests = Array.isArray(pending?.requests) ? pending.requests : [];
    const remaining = requests.filter((request) => request?.key !== key);
    if (remaining.length !== requests.length) {
      if (remaining.length) globalThis.sessionStorage?.setItem(PENDING_GENERATION_KEY, JSON.stringify({ requests: remaining }));
      else globalThis.sessionStorage?.removeItem(PENDING_GENERATION_KEY);
    }
  } catch {
    // Storage can be unavailable in private browsing. The request still has
    // its in-memory key and remains protected once the server persists it.
  }
}
