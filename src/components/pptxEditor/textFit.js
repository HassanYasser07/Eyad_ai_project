import { EMU_PER_PX } from "./engine/slideModel.js";

/**
 * Single source of truth for "how tall must this text frame be at width W?".
 *
 * The browser's own layout engine is the only reliable text-reflow oracle, so we
 * measure the element's real rendered text subtree: clone it into a hidden probe
 * that lives inside the same `.pptx-el` (inheriting fonts / insets / wrapping),
 * force the probe to the candidate width with `height:auto`, and read back the
 * wrapped content height. This is used by every geometry path (handle drag,
 * inspector fields, commit), so a frame can never be smaller than its text.
 *
 * @param {ParentNode} root  the canvas stage (scopes the lookup away from thumbnails)
 * @param {string} id        element id
 * @param {number} widthEmu  candidate frame width
 * @returns {number|null}    required frame height in EMU, or null when not measurable
 */
export function measureTextFrameHeight(root, id, widthEmu) {
  if (!root || typeof document === "undefined" || !Number.isFinite(widthEmu) || widthEmu <= 0) return null;
  const esc = (typeof CSS !== "undefined" && CSS.escape) ? CSS.escape(String(id)) : String(id).replace(/["\\]/g, "\\$&");
  const host = root.querySelector(`.pptx-el[data-id="${esc}"]`);
  const box = host && [...host.children].find((c) => c.classList?.contains("pptx-text"));
  if (!box) return null;
  const probe = box.cloneNode(true);
  probe.classList.remove("is-inline-editing");
  probe.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
  Object.assign(probe.style, {
    position: "absolute", inset: "auto", left: "0px", top: "0px", right: "auto", bottom: "auto",
    width: `${widthEmu / EMU_PER_PX}px`, height: "auto", visibility: "hidden", pointerEvents: "none",
  });
  host.appendChild(probe);
  try {
    const content = probe.querySelector(".pptx-text-content");
    if (!content) return null;
    const css = window.getComputedStyle(probe);
    const pad = (Number.parseFloat(css.paddingTop) || 0) + (Number.parseFloat(css.paddingBottom) || 0);
    const natural = Math.max(content.scrollHeight, content.offsetHeight);
    if (!Number.isFinite(natural) || natural <= 0) return null;
    // +1px matches the live typing measurement so both paths agree exactly.
    return Math.ceil((natural + pad + 1) * EMU_PER_PX);
  } finally {
    probe.remove();
  }
}

/** Elements whose frame is derived from their text (not tables, groups, pictures, lines, empty boxes). */
export function isTextFitElement(el) {
  if (!el || el.kind === "table" || el.kind === "group" || el.kind === "image" || el.kind === "chart") return false;
  if (el.geom?.kind === "line") return false;
  return !!el.text && !el.text.isEmpty;
}
