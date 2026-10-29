import React from "react";

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml" };

/** Blob URLs for media parts, cached on the package so slide switches are instant. */
export function useMediaUrls(pkg, paths) {
  const [, bump] = React.useReducer((n) => n + 1, 0);
  const key = paths.join("|");
  React.useEffect(() => {
    if (!pkg) return undefined;
    const cache = (pkg.urlCache ||= new Map());
    let live = true;
    for (const p of paths) {
      if (!p || cache.has(p)) continue;
      const mime = MIME[p.slice(p.lastIndexOf(".") + 1).toLowerCase()];
      if (!mime) continue;
      cache.set(p, null);
      pkg.bytes(p).then((bytes) => {
        // Remove the in-flight marker when the part is missing so a later render
        // (e.g. revisiting the slide) retries instead of showing "Loading…" forever.
        if (!bytes) { cache.delete(p); return; }
        if (!pkg.urlCache) return;
        cache.set(p, URL.createObjectURL(new Blob([bytes], { type: mime })));
        if (live) bump();
      }).catch(() => cache.delete(p));
    }
    return () => { live = false; };
     
  }, [pkg, key]);
  const out = {};
  if (pkg?.urlCache) for (const p of paths) { const u = pkg.urlCache.get(p); if (u) out[p] = u; }
  return out;
}
export function disposeMediaUrls(pkg) {
  if (!pkg?.urlCache) return;
  for (const u of pkg.urlCache.values()) if (u) URL.revokeObjectURL(u);
  pkg.urlCache = null;
}
