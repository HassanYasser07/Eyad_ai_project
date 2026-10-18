# Test Presentation Environment (PPTX editor)

A separate editing environment opened from the **Test Presentation Environment** button in the Presentation
Studio. It imports a real `.pptx`, edits individual slide objects, and exports an editable `.pptx`.
The existing AI presentation-generation workflow is not modified.

Code: `src/components/pptxEditor/` (UI) and `src/components/pptxEditor/engine/` (document engine, no React).

## Engine decision (researched 2026-10; re-verify before relying on it)

| Candidate | Verified finding | Result |
|---|---|---|
| SlideWise (MIT, `textcortex/SlideWise`) | Peer dep `react >=19` (app is on 18). Canvas/selection use only `mousedown/mousemove/mouseup` — no pointer/touch events, no `touch-action`, no pinch, so no touch drag/resize/rotate. Its own changelog calls its serialize round-trip lossy. | Not usable on mobile / this React |
| ONLYOFFICE Docs | Best engine (PPTX is native) and has mobile web editors, **but** those are only in the proprietary Developer/Enterprise editions (Community = AGPL-3.0, no mobile web editors). Needs a self-hosted Document Server + file storage/callback service + JWT secret + a licence. The Developer pricing page listed a $3,500 starting configuration (verify with the vendor). | Strongest option; needs paid infra that was not provisioned |
| Univer Slides | PPTX import/export is a Pro feature that needs a Univer Server conversion backend; unlicensed use shows a watermark. Mobile Slides behaviour was not verified. | Needs paid backend |
| PPTist | Vue (not React), AGPL-3.0, author rates own PPTX import ≈70–80%. | Rejected |
| PptxGenJS, viewers, `pptx-react-viewer` | Generators/viewers, not editors of existing decks; `pptx-react-viewer` was excluded per the brief. | Not editing engines |

No free, local engine satisfied import + edit + export + touch. The editor therefore edits the **OOXML package directly**:
the original zip is kept, only the slide parts the user edited are re-serialised, and every other part
(masters, layouts, themes, notes, charts, fonts, untouched slides, animations) is copied byte-for-byte.
This is the same principle SlideWise moved to after finding its lossy round-trip.

**Recommended upgrade path for full fidelity** (charts, SmartArt, full text-run editing, animations UI):
ONLYOFFICE Docs Developer Edition behind the same button. Cost/infra: licence + a VM running Document
Server (Docker) reachable over HTTPS + a storage/callback endpoint + JWT secret kept server-side. Static
hosting cannot run Document Server, so this is a separate deployment decision.

## Architecture

- `engine/package.js` – zip validation (size/entries/zip-bomb/macro/OLE/DOCTYPE), transactions, undo/redo, relationships and content types, validation, byte-preserving export with pruning of orphaned parts.
- `engine/slideModel.js` – read-only view model: placeholder inheritance (slide → layout → master), text style chain, theme colours, fills/lines (incl. `p:style`), groups (flattened to absolute coordinates), tables, chart data for a **view-only** preview, duplicate-id safe keys.
- `engine/ops.js`, `engine/slides.js` – every edit is one undoable transaction on the real XML (schema-ordered children, so PowerPoint does not "repair").
- `SlideView.jsx` renders the model; `Canvas.jsx` handles input.
- Selection frame/handles live in a **screen-space overlay above the slide**: they can never be covered by the selected object, stay a constant 44px touch size at any zoom, and are not clipped. Hit-testing is geometric (rotated boxes), not DOM-based.
- `fileIO.js` – native save/share (Capacitor Filesystem + Share) on Android/iOS; Web Share or download on the web; IndexedDB drafts.

## Platforms

- **Web desktop**: slide sidebar (drag to reorder), ribbon, large canvas, inspector (Format / Arrange / Layers), shortcuts (Ctrl+Z/Y, Ctrl+D, Ctrl+C/V, Ctrl+G, arrows, Del, Alt+click = select behind, Ctrl+wheel zoom).
- **Phone (web, Android, iOS — all the same WebView build)**: compact top bar (close, undo, redo, export, more); canvas; floating slide pill (prev/next, opens thumbnail drawer); contextual bottom toolbar; non-modal bottom sheets (the canvas refits above them); dedicated text-editing sheet using a native `<textarea>` (≥16px so iOS does not zoom); pinch zoom, two-finger pan, double-tap to fit; multi-select mode; "select behind" button + Layers list for covered objects; 44px handles.
- Behaviour on rotation/keyboard: root height follows `visualViewport`; the bottom bar hides during text entry; landscape touch phones get an icon-only toolbar.
- Lifecycle: draft autosaved ~1.2s after an edit and immediately on `visibilitychange→hidden`/`pagehide`; draft offered on next open; unsaved-changes confirm on close; reset to original.

## Required action on your side (not done in this repo)

1. `npm install` then **`npx cap sync`** so `@capacitor/filesystem` and `@capacitor/share` (v8) are registered in the Android and iOS projects. Without it, native export falls through to a failing path; web is unaffected.
2. Recommended (not changed here because it is global): add `viewport-fit=cover` to `index.html`. Without it iOS may report 0 for `env(safe-area-inset-*)`; the editor uses `max(env(...), …)` so it stays usable either way.
3. The zip contained no `.github/workflows/ci.yml`; do not commit its deletion.

## Known limitations (also surfaced in the in-app Import report)

- Charts, SmartArt, OLE objects, 3D/equation (`mc:AlternateContent`): preserved byte-for-byte, can be moved/resized/deleted. Bar/column/line/pie charts show a **view-only preview drawn from cached data**; chart data cannot be edited.
- Text editing: paragraph text is edited in a text sheet; unedited paragraphs keep all run formatting, edited ones keep the formatting of the run where the change occurred. Format buttons apply to the whole object, not a selection range. Soft line breaks display as U+2028.
- Group children cannot be selected individually (select the group, or ungroup).
- Some preset shapes are drawn as rectangles in the editor (file keeps the real geometry); gradients/picture fills on shapes are approximated; table styles are approximated; EMF/WMF images and external linked pictures are not displayed.
- Animations, transitions, notes, hyperlinks, sections are preserved but not shown/editable. Deleting an animated object removes that slide's animation timeline. Adding/deleting/duplicating/reordering slides removes PowerPoint **sections**. Duplicating a slide drops its notes.
- Locks are editor-session only (not written to the file). Undo history is not restored from a draft.
- Elements pasted between slides: pictures and shapes only (charts/SmartArt are refused with a message).
- Text uses installed fonts; the Georgia/serif/mono fallbacks are generic.

## Security

Uploads are untrusted: extension/size pre-check, zip signature, entry-count/uncompressed-size limits, macro-enabled and legacy/encrypted files rejected, XML with DOCTYPE/ENTITY rejected, no external resources are fetched (linked pictures blocked), all text rendered as React text nodes (no `innerHTML`), colours validated as 6-hex, images limited to png/jpeg/gif. Nothing is uploaded to any server; no secrets are involved.

## Tests

```
npm run test:pptx                      # 25 engine tests (Node, @xmldom/xmldom)
tests/e2e/run.sh tests/e2e/desktop.py tests/e2e/desktop_content.py \
                 tests/e2e/mobile.py tests/e2e/mobile_text.py tests/e2e/rtl.py
```
The e2e scripts need Python + Playwright + a local Chromium (`CHROME_PATH`) and drive the dev-only harness
`tests/e2e/harness/` (not part of the build). They use Chromium **touch emulation**, not a real Android/iOS WebView or device.
Fixtures are built by `tests/pptx/make_fixtures.py` (python-pptx), plus one LibreOffice-written and one PptxGenJS-written deck.
`tests/pptx/robustness.mjs` runs an edit battery over any decks and `make_edited.mjs` writes edited exports for third-party validation.
