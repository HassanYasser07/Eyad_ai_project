/**
 * ImageCropper — professional aspect-ratio crop frame for generated images.
 *
 * - Pick an aspect ratio (Free / 1:1 / 4:3 / 3:4 / 16:9 / 9:16 / 3:2 / 2:3).
 * - A crop frame appears on the image: drag it to move, drag the handles to resize
 *   (the selected ratio is locked while resizing).
 * - The parent receives the crop rectangle in the image's NATURAL pixels, and can
 *   use `cropImageSource()` to produce the cropped PNG when exporting.
 *
 * Works with mouse, touch and pen through Pointer Events.
 */
import React from "react";
import { Crop, RotateCcw } from "lucide-react";

export const CROP_RATIOS = [
  { id: "original", ar: "الأصلي", en: "Original", value: null },
  { id: "free", ar: "حر", en: "Free", value: "free" },
  { id: "1:1", ar: "1:1", en: "1:1", value: 1 },
  { id: "4:3", ar: "4:3", en: "4:3", value: 4 / 3 },
  { id: "3:4", ar: "3:4", en: "3:4", value: 3 / 4 },
  { id: "16:9", ar: "16:9", en: "16:9", value: 16 / 9 },
  { id: "9:16", ar: "9:16", en: "9:16", value: 9 / 16 },
  { id: "3:2", ar: "3:2", en: "3:2", value: 3 / 2 },
  { id: "2:3", ar: "2:3", en: "2:3", value: 2 / 3 },
];

const HANDLES = [
  { id: "nw", hx: -1, hy: -1, corner: true },
  { id: "n", hx: 0, hy: -1 },
  { id: "ne", hx: 1, hy: -1, corner: true },
  { id: "e", hx: 1, hy: 0 },
  { id: "se", hx: 1, hy: 1, corner: true },
  { id: "s", hx: 0, hy: 1 },
  { id: "sw", hx: -1, hy: 1, corner: true },
  { id: "w", hx: -1, hy: 0 },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Largest centred frame of `ratio` that fits inside the image (scaled by `inset`). */
function fitFrame(W, H, ratio, inset = 0.88) {
  let w = W * inset;
  let h = w / ratio;
  if (h > H * inset) { h = H * inset; w = h * ratio; }
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("CROP_IMAGE_LOAD_FAILED"));
    image.src = source;
  });
}

/**
 * Crops `source` (URL or data URL) to `rect` (natural pixels) and returns a PNG
 * data URL. The image is first fetched as a blob so remote (CORS-enabled) assets
 * never taint the canvas.
 */
export async function cropImageSource(source, rect) {
  if (!source || !rect) return source;
  let objectUrl = null;
  try {
    let readable = source;
    if (!source.startsWith("data:")) {
      const response = await fetch(source, { mode: "cors" });
      if (!response.ok) throw new Error("CROP_SOURCE_FETCH_FAILED");
      objectUrl = URL.createObjectURL(await response.blob());
      readable = objectUrl;
    }
    const image = await loadImageElement(readable);
    const sx = Math.round(clamp(rect.x, 0, image.naturalWidth - 1));
    const sy = Math.round(clamp(rect.y, 0, image.naturalHeight - 1));
    const sw = Math.max(1, Math.min(Math.round(rect.w), image.naturalWidth - sx));
    const sh = Math.max(1, Math.min(Math.round(rect.h), image.naturalHeight - sy));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("CROP_CANVAS_UNAVAILABLE");
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL("image/png");
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Props:
 *  - src:      image URL / data URL shown in the stage
 *  - alt:      image alt text
 *  - ar:       Arabic UI
 *  - onChange: ({ rect, natural, active }) => void
 *              rect   = crop rect in natural pixels, or null when no crop is applied
 *              active = true when a crop smaller than the full image is selected
 */
function ImageCropperInner({ src, alt = "", ar = false, onChange }) {
  const stageRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const [natural, setNatural] = React.useState({ w: 0, h: 0 });
  const [ratioId, setRatioId] = React.useState("original");
  const [rect, setRect] = React.useState(null);
  const [dragging, setDragging] = React.useState(false);

  const ratioDef = CROP_RATIOS.find((item) => item.id === ratioId) || CROP_RATIOS[0];
  const locked = typeof ratioDef.value === "number";

  // Report the effective crop to the parent.
  React.useEffect(() => {
    if (!onChange) return;
    if (!rect || !natural.w) {
      onChange({ rect: null, natural, active: false });
      return;
    }
    const full = rect.w >= natural.w - 1 && rect.h >= natural.h - 1;
    onChange({ rect: full ? null : { ...rect }, natural, active: !full });
  }, [rect, natural, onChange]);

  const minSize = natural.w ? Math.max(24, Math.min(natural.w, natural.h) * 0.06) : 24;

  const chooseRatio = (item) => {
    setRatioId(item.id);
    if (!natural.w) return;
    if (item.value === null) { setRect(null); return; }
    if (item.value === "free") { setRect({ x: natural.w * 0.06, y: natural.h * 0.06, w: natural.w * 0.88, h: natural.h * 0.88 }); return; }
    setRect(fitFrame(natural.w, natural.h, item.value));
  };

  const reset = () => {
    if (ratioDef.value !== null) chooseRatio(ratioDef);
  };

  const toNatural = (clientX, clientY) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return { x: 0, y: 0 };
    return {
      x: clamp(((clientX - box.left) / box.width) * natural.w, 0, natural.w),
      y: clamp(((clientY - box.top) / box.height) * natural.h, 0, natural.h),
    };
  };

  const startDrag = (event, mode, handle = null) => {
    if (!rect || event.button > 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const p = toNatural(event.clientX, event.clientY);
    dragRef.current = { mode, handle, start: p, origin: { ...rect }, pointerId: event.pointerId };
    setDragging(true);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const p = toNatural(event.clientX, event.clientY);
    const { origin } = drag;
    const W = natural.w;
    const H = natural.h;

    if (drag.mode === "move") {
      setRect({
        ...origin,
        x: clamp(origin.x + (p.x - drag.start.x), 0, W - origin.w),
        y: clamp(origin.y + (p.y - drag.start.y), 0, H - origin.h),
      });
      return;
    }

    const { hx, hy } = drag.handle;

    if (locked) {
      // Corner resize with the aspect ratio locked; the opposite corner is the anchor.
      const r = ratioDef.value;
      const ax = hx > 0 ? origin.x : origin.x + origin.w;
      const ay = hy > 0 ? origin.y : origin.y + origin.h;
      const rawW = Math.abs(p.x - ax);
      const rawH = Math.abs(p.y - ay);
      const maxW = hx > 0 ? W - ax : ax;
      const maxH = hy > 0 ? H - ay : ay;
      let w = Math.max(rawW, rawH * r);
      w = Math.min(w, maxW, maxH * r);
      w = Math.max(w, minSize * Math.max(1, r));
      const h = w / r;
      setRect({ x: hx > 0 ? ax : ax - w, y: hy > 0 ? ay : ay - h, w, h });
      return;
    }

    // Free resize: each edge follows the pointer independently.
    let left = origin.x;
    let right = origin.x + origin.w;
    let top = origin.y;
    let bottom = origin.y + origin.h;
    if (hx < 0) left = clamp(p.x, 0, right - minSize);
    if (hx > 0) right = clamp(p.x, left + minSize, W);
    if (hy < 0) top = clamp(p.y, 0, bottom - minSize);
    if (hy > 0) bottom = clamp(p.y, top + minSize, H);
    setRect({ x: left, y: top, w: right - left, h: bottom - top });
  };

  const endDrag = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };

  // Arrow keys nudge the frame; Shift = larger steps.
  const onFrameKeyDown = (event) => {
    if (!rect || !event.key.startsWith("Arrow")) return;
    event.preventDefault();
    const step = (event.shiftKey ? 0.05 : 0.01) * Math.min(natural.w, natural.h);
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    setRect({ ...rect, x: clamp(rect.x + dx, 0, natural.w - rect.w), y: clamp(rect.y + dy, 0, natural.h - rect.h) });
  };

  const pct = (value, total) => (total ? `${(value / total) * 100}%` : "0%");
  const outW = rect ? Math.round(rect.w) : natural.w;
  const outH = rect ? Math.round(rect.h) : natural.h;

  return (
    <div className="eyad-cropper" dir="ltr">
      <div className="eyad-cropper-stage-wrap">
        <div
          ref={stageRef}
          className={`eyad-cropper-stage ${dragging ? "is-dragging" : ""}`}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          />
          {rect && natural.w > 0 && (
            <div
              className="eyad-crop-frame"
              style={{ left: pct(rect.x, natural.w), top: pct(rect.y, natural.h), width: pct(rect.w, natural.w), height: pct(rect.h, natural.h) }}
              onPointerDown={(e) => startDrag(e, "move")}
              onKeyDown={onFrameKeyDown}
              tabIndex={0}
              role="group"
              aria-label={ar ? "إطار القص" : "Crop frame"}
            >
              <i className="eyad-crop-grid" aria-hidden="true" />
              {HANDLES.filter((h) => !locked || h.corner).map((h) => (
                <b
                  key={h.id}
                  className={`eyad-crop-handle eyad-crop-handle--${h.id}`}
                  onPointerDown={(e) => startDrag(e, "resize", h)}
                  aria-hidden="true"
                />
              ))}
              <span className="eyad-crop-badge">{outW} × {outH}</span>
            </div>
          )}
        </div>
      </div>

      <div className="eyad-cropper-toolbar" dir={ar ? "rtl" : "ltr"}>
        <div className="eyad-cropper-title">
          <Crop className="w-4 h-4" />
          <strong>{ar ? "قص الصورة" : "Crop image"}</strong>
          <span>
            {ratioId === "original"
              ? (ar ? "اختر نسبة أبعاد لإظهار إطار القص" : "Pick an aspect ratio to show the crop frame")
              : (ar ? "حرّك الإطار أو اسحب المقابض لتغيير الحجم" : "Drag the frame to move it, drag the handles to resize")}
          </span>
        </div>
        <div className="eyad-cropper-ratios" role="radiogroup" aria-label={ar ? "نسبة الأبعاد" : "Aspect ratio"}>
          {CROP_RATIOS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={ratioId === item.id}
              className={ratioId === item.id ? "is-active" : ""}
              onClick={() => chooseRatio(item)}
              disabled={!natural.w}
            >
              {ar ? item.ar : item.en}
            </button>
          ))}
          {ratioId !== "original" && (
            <button type="button" className="eyad-cropper-reset" onClick={reset} title={ar ? "إعادة ضبط الإطار" : "Reset frame"}>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{ar ? "إعادة ضبط" : "Reset"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Re-mount (and therefore reset the crop) whenever a different image is shown.
export default function ImageCropper(props) {
  return <ImageCropperInner key={props.src} {...props} />;
}
