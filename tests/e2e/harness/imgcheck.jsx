// Browser check: open a real deck and render slide 1 exactly the way Canvas does
// (readSlide -> collectImagePaths -> useMediaUrls -> SlideView), then expose
// per-image diagnostics into the DOM for headless inspection.
import React from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import "@/components/pptxEditor/pptxEditor.css";
import { PptxPackage, readPresentation, readSlide } from "@/components/pptxEditor/engine/index.js";
import SlideView, { collectImagePaths } from "@/components/pptxEditor/SlideView.jsx";
import { useMediaUrls } from "@/components/pptxEditor/useMediaUrls.js";

function ImgCheck() {
  const [state, setState] = React.useState({ stage: "loading", model: null, pkg: null });
  const deck = new URLSearchParams(window.location.search).get("deck") || "user-deck.pptx";
  React.useEffect(() => {
    (async () => {
      const res = await fetch(deck);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const buf = await res.arrayBuffer();
      const pkg = await PptxPackage.open(new Uint8Array(buf), { fileName: deck });
      const pres = readPresentation(pkg);
      const model = readSlide(pkg, pres.slides[0].path, pres);
      setState({ stage: "ready", model, pkg });
    })().catch((e) => setState({ stage: "error:" + String(e?.message || e) }));
  }, [deck]);
  const pkg = state.pkg, model = state.model;
  const urls = useMediaUrls(pkg, model ? collectImagePaths(model) : []);
  const paths = model ? collectImagePaths(model) : [];
  const ready = paths.filter((p) => urls[p]).length;
  const W = model ? model.size.w / 9525 : 1;
  const H = model ? model.size.h / 9525 : 1;
  return (
    <div>
      <div id="diag" data-stage={state.stage} data-total={paths.length} data-ready={ready} data-slidesize={`${W}x${H}`}>
        {paths.map((p) => (
          <div key={p} className="diag-line" data-path={p} data-url={urls[p] ? "blob" : "none"}>{p}: {urls[p] ? "URL ok" : "no url"}</div>
        ))}
      </div>
      {model && (
        <div className="pe-holder" style={{ width: W, height: H, transform: "scale(0.55)", transformOrigin: "top left" }}>
          <SlideView model={model} urls={urls} hints={false} labels={{}} />
        </div>
      )}
      {state.stage === "error:" && <div id="err">{state.stage}</div>}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<ImgCheck />);
