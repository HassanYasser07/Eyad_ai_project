const REQUEST_PREFIX = "eyad:generation-request:";

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function fingerprintRequest(request, webCrypto) {
  const bytes = new TextEncoder().encode(JSON.stringify(request));
  const digest = await webCrypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function getGenerationRequestId(request, storage = globalThis.localStorage, webCrypto = globalThis.crypto) {
  if (!webCrypto?.subtle || !webCrypto?.randomUUID) throw new Error("SECURE_IDEMPOTENCY_UNAVAILABLE");
  const fingerprint = await fingerprintRequest(request, webCrypto);
  const storageKey = `${REQUEST_PREFIX}${fingerprint}`;
  if (storage) {
    try {
      const saved = JSON.parse(storage.getItem(storageKey) || "null");
      const savedRequestKey = saved?.requestKey || saved?.idempotencyKey;
      if (isUuid(savedRequestKey)) return savedRequestKey;
    } catch {
      // Replace malformed or inaccessible prior state with a fresh request identity.
    }
  }

  const requestKey = webCrypto.randomUUID();
  if (storage) {
    try {
      storage.setItem(storageKey, JSON.stringify({ requestKey, jobId: null }));
    } catch {
      // The server remains authoritative; storage is only used to reuse a key across reloads.
    }
  }
  return requestKey;
}

export async function rememberGenerationRequestJob(request, jobId, storage = globalThis.localStorage, webCrypto = globalThis.crypto) {
  if (!storage || !jobId) return;
  const fingerprint = await fingerprintRequest(request, webCrypto);
  const storageKey = `${REQUEST_PREFIX}${fingerprint}`;
  try {
    const saved = JSON.parse(storage.getItem(storageKey) || "null");
    if (isUuid(saved?.requestKey || saved?.idempotencyKey)) storage.setItem(storageKey, JSON.stringify({ ...saved, requestKey: saved?.requestKey || saved?.idempotencyKey, jobId }));
  } catch {
    // The request remains safe on the server even when browser storage is unavailable.
  }
}

export function clearGenerationRequestForJob(jobId, storage = globalThis.localStorage) {
  if (!storage || !jobId) return;
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (!key?.startsWith(REQUEST_PREFIX)) continue;
      const saved = JSON.parse(storage.getItem(key) || "null");
      if (saved?.jobId === jobId) storage.removeItem(key);
    }
  } catch {
    // Cleanup is best effort; it does not affect server-side uniqueness.
  }
}

export function clearGenerationRequest(request, storage = globalThis.localStorage, webCrypto = globalThis.crypto) {
  if (!storage || !webCrypto?.subtle) return Promise.resolve();
  return fingerprintRequest(request, webCrypto).then((fingerprint) => {
    try { storage.removeItem(`${REQUEST_PREFIX}${fingerprint}`); } catch { /* best effort */ }
  });
}
