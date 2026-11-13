import React from "react";

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml" };

/**
 * Blob URLs for media parts, cached on the package so slide switches are instant.
 *
 * The cache is shared by every consumer of the package (main canvas, slide thumbnails, layers panel, ...).
 * The first consumer that asks for a path starts the load and marks it in-flight; other consumers that
 * mount meanwhile skip it. So when a load finishes, EVERY subscribed consumer must be notified — not only
 * the one that started it — otherwise the others (e.g. the side thumbnails) stay on "Loading…" forever.
 */
function notifyAll(pkg) {
  const listeners = pkg.urlListeners;
  if (listeners) for (const fn of Array.from(listeners)) fn();
}

export function useMediaUrls(pkg, paths) {
  const [version, bump] = React.useReducer((n) => n + 1, 0);
  const key = paths.join("|");

  // Subscribe to "a url finished loading" for this package.
  React.useEffect(() => {
    if (!pkg) return undefined;
    const listeners = (pkg.urlListeners ||= new Set());
    listeners.add(bump);
    // A url may have finished between render and subscription — re-read once.
    bump();
    return () => { pkg.urlListeners?.delete(bump); };
  }, [pkg]);

  React.useEffect(() => {
    if (!pkg) return undefined;
    const cache = (pkg.urlCache ||= new Map());
    for (const p of paths) {
      if (!p || cache.has(p)) continue;
      const mime = MIME[p.slice(p.lastIndexOf(".") + 1).toLowerCase()];
      if (!mime) continue;
      cache.set(p, null);
      pkg.bytes(p).then((bytes) => {
        // Remove the in-flight marker when the part is missing so a later render
        // (e.g. revisiting the slide) retries instead of showing "Loading…" forever.
        if (!bytes) { cache.delete(p); return; }
        if (pkg.urlCache !== cache) return; // package disposed meanwhile
        cache.set(p, URL.createObjectURL(new Blob([bytes], { type: mime })));
        notifyAll(pkg);
      }).catch(() => cache.delete(p));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg, key]);

  // Same object between renders unless a url finished loading or the path set changed, so memoized slide
  // elements are not invalidated on every render (e.g. on each frame of a drag).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => {
    const out = {};
    if (pkg?.urlCache) for (const p of paths) { const u = pkg.urlCache.get(p); if (u) out[p] = u; }
    return out;
  }, [pkg, key, version]);
}
export function disposeMediaUrls(pkg) {
  if (!pkg?.urlCache) return;
  for (const u of pkg.urlCache.values()) if (u) URL.revokeObjectURL(u);
  pkg.urlCache = null;
}
