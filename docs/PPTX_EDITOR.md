# Test Presentation Environment (PPTX editor)

A separate editing environment opened from the **Test Presentation Environment** button in the Presentation
Studio. It imports a real `.pptx`, edits individual slide objects, and exports an editable `.pptx`.
The existing AI presentation-generation workflow is not modified.

The editor is lazy-loaded from Presentation Studio. The entry point now shows an explicit loading state and a recoverable error panel if its module fails to load, rather than silently showing a blank screen. Keep the imports in `Inspector.jsx` and `PptxEditorDialog.jsx` in sync when changing contextual panel or ribbon controls.

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
Server (Docker) reachable over HTTPS + a storage/callback endpoint + JWT secret kept server-side. Base44
cannot host Document Server, so this is a separate deployment decision.

## Architecture

- `engine/package.js` – zip validation (size/entries/zip-bomb/macro/OLE/DOCTYPE), transactions, undo/redo, relationships and content types, validation, byte-preserving export with pruning of orphaned parts.
- `engine/slideModel.js` – read-only view model: placeholder inheritance (slide → layout → master), text style chain, theme colours, fills/lines (incl. `p:style`), groups (flattened to absolute coordinates), tables, chart data for a **view-only** preview, duplicate-id safe keys.
- `engine/ops.js`, `engine/slides.js` – every edit is one undoable transaction on the real XML (schema-ordered children, so PowerPoint does not "repair"). Slide backgrounds can be set to a solid colour for the active slide or every slide in one undoable action, or reset to the layout/master background. Design has an Apply current background to every slide checkbox: enabling it immediately copies the current solid background and keeps background edits/presets scoped to all slides until unchecked. A separate Reset-all command is available; when the checkbox is off, ordinary background edits affect only the active slide. Shape outlines support solid, dashed, dotted, dash-dot, long, and system dash presets. Opacity is written to the OOXML fill and outline alpha transforms for shapes/connectors and to picture alpha transforms for images.
- `SlideView.jsx` renders the model; `Canvas.jsx` handles input.
- Selection frame/handles live in a **screen-space overlay above the slide**: they can never be covered by the selected object, stay a constant 44px touch size at any zoom, and are not clipped. Hit-testing is geometric (rotated boxes), not DOM-based.
- `fileIO.js` – native save/share (Capacitor Filesystem + Share) on Android/iOS; Web Share or download on the web; IndexedDB drafts.

## Platforms

- **Web desktop**: Workflow ribbon (`Home`, `Insert`, `Design`, contextual `Text`, contextual `Shapes`, contextual `Image`, `View`), slide thumbnail sidebar, canvas, and a right utility sidebar with only `Arrange` and `Layers`. Text/Shapes/Image tabs activate for relevant selected objects; layer cards support visibility, session locking, front-to-back drag/drop, and labelled Bring to front/Bring forward/Send backward/Send to back controls. Per-card move arrows are intentionally removed. Presentation preview is available from the top bar and View ribbon.
- **Phone (web, Android, iOS)**: touch-first bottom navigation for Home / Insert / Design / Text / Shapes / Image / Arrange / Layers / Slides / View. Grouped ribbon and sidebar tools open in bounded, scrollable bottom sheets (maximum height 72dvh); Text/Shapes/Image sections activate based on object selection. Arrange provides four 1-point nudge arrows and an interactive rotation dial. Layers include show/hide, session lock/unlock, labelled z-order commands, and touch drag handles. Fit-to-screen remeasures canvas bounds; Presentation Preview shows rendered slides with touch navigation.
- Behaviour on rotation/keyboard: root height follows `visualViewport`; the bottom bar hides during text entry; landscape touch phones get an icon-only toolbar.
- Lifecycle: draft autosaved ~1.2s after an edit and immediately on `visibilitychange→hidden`/`pagehide`; draft offered on next open; unsaved-changes confirm on close; reset to original.

## Required action on your side (not done in this repo)

1. `npm install` then **`npx cap sync`** so `@capacitor/filesystem` and `@capacitor/share` (v8) are registered in the Android and iOS projects. Without it, native export falls through to a failing path; web is unaffected.
2. Recommended (not changed here because it is global): add `viewport-fit=cover` to `index.html`. Without it iOS may report 0 for `env(safe-area-inset-*)`; the editor uses `max(env(...), …)` so it stays usable either way.
3. The zip contained no `.github/workflows/ci.yml`; do not commit its deletion.

## Known limitations (also surfaced in the in-app Import report)

- Slide backgrounds support solid colours, apply-to-all, and reset/inheritance; gradients and picture backgrounds are not directly editable. The searchable categorized gallery provides 44 insertable shape presets covering basic geometry, lines/connectors, block arrows, stars/symbols, callouts, and flowchart shapes. Shape outlines support the standard PowerPoint preset dash patterns.
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

## Ribbon and formatting workflow

The editor uses a PowerPoint-inspired workflow ribbon: `Home`, `Insert`, `Design`, `Text`, `Shapes`, and `View`. The right utility sidebar contains only `Arrange` and `Layers`. Text and Shapes are contextual sections that auto-activate for compatible selections, and their edit controls are disabled for incompatible objects. On phones, the same commands use bottom navigation and bounded scrollable sheets instead of a compressed desktop ribbon.

Current supported formatting includes solid fills, no-fill, line colour and no-line, outline thickness and 11 dash styles, object opacity for shape fill + outline, connector strokes, and picture pixels + border where present, text font/size/colour/style/alignment, exact position and dimensions, rotation and flips, z-order, align/distribute, grouping, locking, image replacement/alt text, and table cell/row/column operations. Selected objects expose quick Copy-to-editor-clipboard, Rotate 90°, and Delete actions on the blue selection frame (Ctrl+C, Shift+R, and Delete shortcuts respectively); Ctrl+D remains available for duplication. Gradient/picture shape fills, quick-style effect galleries, charts-data editing, animation/transition editing, and SmartArt authoring are **not** claimed as implemented.

## Tests

```
npm run test:pptx                      # PPTX engine regression tests (Node, @xmldom/xmldom)
tests/e2e/run.sh tests/e2e/desktop.py tests/e2e/desktop_content.py \
                 tests/e2e/mobile.py tests/e2e/mobile_text.py tests/e2e/rtl.py
```
The e2e scripts need Python + Playwright + a local Chromium (`CHROME_PATH`) and drive the dev-only harness
`tests/e2e/harness/` (not part of the build). They use Chromium **touch emulation**, not a real Android/iOS WebView or device.
Fixtures are built by `tests/pptx/make_fixtures.py` (python-pptx), plus one LibreOffice-written and one PptxGenJS-written deck.
`tests/pptx/robustness.mjs` runs an edit battery over any decks and `make_edited.mjs` writes edited exports for third-party validation.


## Current contextual editing revision (October 18, 2026)

- **Design** contains the single apply-current-solid-background-to-all-slides control; enabling it applies the current colour immediately. Reset-all is a separate command. Unsupported gradient/picture slide backgrounds are not silently replaced.
- **Text** includes insert/edit/delete text, font, size, bold, italic, underline, strikethrough, colour, highlight, paragraph alignment and bullets. These format controls are disabled unless a compatible text object is selected (table content uses the table editor).
- **Shapes** includes categorized insertion plus fill/no-fill, stroke colour and width, 11 dash patterns, opacity (where supported), flips, duplicate and delete. Fill is disabled for line-only selections.
- **Arrange** includes four 1-point nudges, position/size, an interactive rotation dial, flip, align/distribute, group/ungroup, duplicate/delete and select-behind. **Layers** includes per-object hide/show, editor-session lock/unlock, front/forward/backward/back commands, cards with thumbnails/icons and drag/drop sequencing. Visibility is exported to PPTX and hidden objects are not drawn on the canvas or preview; lock state is not exported.
- **View** has fit-to-screen and Presentation Preview, with slide navigation and Escape to exit. Phone tool panels are scrollable bottom sheets capped at 72dvh.
- Regression tests were added for layer visibility/reordering and text highlight/strikethrough. Run `npm ci` then `npm run test:pptx` to execute them. Runtime build/device verification must still be done in an environment with dependencies and Android/iOS simulators/devices.


## Recent consistency and selection refinements (October 18, 2026)

- Opacity controls use the editor's wavy slider treatment, display a numeric percentage, and update the PPTX drawing model rather than preview CSS alone. Shapes and connectors receive alpha transforms on fills and outlines; picture alpha and any explicit picture border are kept in sync. Returning opacity to 100% removes prior transparency transforms.
- Font and outline-style selects now share the same card height, border, and text scale as the numeric fields.
- Design uses a persistent, localized checkbox for all-slide background scope plus six quick background presets, reset-current-to-theme, and reset-all-to-theme actions. While checked, background color/preset changes are applied across the presentation; unchecking restores per-slide scope.
- Layer ordering actions display their labels. Each layer card selects from its full surface (utility buttons retain their own actions); per-card up/down arrows are removed to reduce clutter. Drag reorder uses the same front-to-back order as the visible panel and remains one undoable transaction, including decks with duplicate shape IDs.
- The selection frame includes Copy, Rotate 90°, and Delete quick actions. Keyboard shortcuts: Ctrl+C copies to the editor clipboard, Delete/Backspace removes, and Shift+R rotates 90°; Ctrl+D remains available for duplication.
- Regression coverage was added for shape/connector/picture opacity round-trips and reordering from every layer position. Run the full test/build/lint suite after installing dependencies; runtime/device validation is still required before release.


## Colour palettes, custom colours, flipping and temporary visibility

- The Design ribbon includes 20 coordinated five-colour palettes. Each palette preview is opened from the round multi-colour palette button. Palette colour 1 becomes the slide background; text boxes receive distinct accent colours in document order, while shapes, connectors, picture borders, and table cells use the palette accents. Text inside coloured shapes/cells uses a foreground selected for contrast. Each palette is one undoable operation. Unsupported picture pixels are not recoloured.
- The SVG editor exposes the same 20 palettes and assigns colours per text/shape item; its first palette colour is applied to the artboard background. Palette application changes SVG content and is therefore included in exported SVG.
- PPTX colour fields (background, text, highlight, shape fill and outline) expose preset/theme swatches, a native OS colour picker, and editable six-digit HEX. SVG background, gradient stops, fill and stroke fields also expose the native colour picker and HEX entry.
- Horizontal and vertical flip controls are available in the contextual Text, Shapes and Image ribbons when the current selection supports geometry transforms. Flips are written to the OOXML `xfrm` data and persist in exported PPTX files. SVG flip operations use the selected object's measured parent-space bounds.
- View's **Hide/Show selected in editor** is a temporary visibility helper. It affects the editor canvas and preview only; it does not alter the PPTX package or exported SVG. It resets when switching slides or reopening the editor.
- When text boxes are resized, the engine applies PowerPoint's `normAutofit`. The viewer preserves imported run font sizes for ordinary text boxes and table cells; browser-measured shrinking is only enabled when the source text body explicitly requests `normAutofit` and has not already persisted a reduced `fontScale`. This avoids titles and normal text silently becoming smaller just because a slide was opened and prevents an existing OOXML font scale from being applied twice. The viewer honours any `fontScale` already stored in the PPTX XML.

### Palette module deployment note
The palette UI depends on all three shared files: `src/components/shared/ColorPalettePicker.jsx`, `src/components/shared/colorPalettePicker.css`, and `src/components/shared/presentationPalettes.js`. When updating an existing checkout by copying individual files, add these new files as well as replacing the modified editor files. Missing shared modules can prevent the lazy-loaded PowerPoint editor from opening. The editor-loading fallback now exposes the caught error message and retries with a fresh lazy component instance.
#### Stability note
Text-fit measurements are only run for source text bodies explicitly marked with `normAutofit`, never for ordinary text boxes or table cells. Imported run sizes and DrawingML insets are preserved by default. When fitting is explicitly requested, measurements are scheduled against the fixed text frame and do not observe the scale-changing content; canvas/mobile viewport updates are idempotent.

## Latest UX update — Design scopes, custom colours, and Tables

- The Design background swatch has a larger visual preview. Its centered **Apply current background to every slide** checkbox applies the current solid background immediately and restores each slide's original background nodes when unchecked, without reverting other slide edits.
- The Design palette group includes **Apply selected palette to all slides** beneath **Browse palettes**. Enabling it applies the selected coordinated palette to every slide; unchecking restores the prior background and palette-managed fill, outline, and text colours while preserving unrelated content, geometry, and table edits. Choose another palette while enabled to update all slides; the original snapshot remains the restore point until unchecked.
- Custom-colour picking remains available anywhere the PPTX editor uses `ColorField` (background, text, highlight, fills, outlines and table cell formatting). SVG colour cards also have an explicit **Choose any color** button alongside HEX entry.
- A dedicated **Tables** ribbon section and **Insert Table** command are available. Insert between 1 and 12 rows and columns; then edit cells, insert/delete rows and columns, choose first/header/total and banded-row/column options, set individual cell fills, and format selected cell text size, colour, highlight, bold, italic, underline and alignment. Row/column structural edits are disabled for tables containing merged cells to avoid damaging their grid.
- Layer order buttons are ordered Bring to Front, Send to Back, Bring Forward, Send Backward.
- Regression coverage includes table insertion, cell fill and text formatting, table design flags, row/column edits, valid PPTX round-trip, and background restoration that preserves unrelated slide edits.



## Table editing

The Insert ribbon and dedicated Tables ribbon can insert a 1–12 row/column table. The Table inspector edits cell contents and exposes row/column insertion and deletion, per-cell fill/text/highlight with the visible **Choose any color** picker, font family and size, bold/italic/underline/strikethrough, horizontal and vertical alignment, and table-design switches for header/total rows, first/last columns, and banded rows/columns. Formatting controls are disabled for locked tables; structural row/column edits are blocked for tables with merged cells.


## In-place text and table editing (October 18, 2026)

- Text boxes and text inside shapes are edited directly on the slide: select the object, then double-click its text (or use the Text ribbon's Edit command). The canvas becomes content-editable; Enter creates a line/paragraph and Ctrl/Cmd+Enter commits. Escape cancels. No value-entry dialog is used for normal text edits.
- Tables remain selected as normal canvas objects. Click once inside a cell to select that cell; double-click the cell text to edit it in place. The Tables ribbon owns table editing: choose Cell, Row, Column, or Entire table as the formatting scope, then use font, emphasis, colour/highlight, cell fill, horizontal/vertical alignment, table style flags and row/column insertion/deletion controls. Clicking another cell returns the scope to Cell.
- The Design palette picker and its adjacent apply-to-all checkbox share the same 66px card height as the slide-background picker and all-slide background checkbox. On compact/mobile layouts the palette picker and scope checkbox remain side-by-side inside the scrollable ribbon sheet.
- Newly inserted shapes and tables use real empty DrawingML paragraphs/cells, not zero-width placeholder characters. Imported/editable text is sanitized to remove U+200B and U+FEFF before rendering, insertion, or save. Table-design flags now render first/last columns and total rows as well as header/banded rows and columns.
- Regression checks cover inline editing paths, table selection scope localization, matched Design card heights, and zero-width placeholder cleanup. Run `npm run test:reliability` after changing these behaviors.

## Text sizing and inline editing safeguards

- Table ribbon top alignment imports the matching Lucide icon explicitly to avoid a runtime reference error when selecting a table.
- Text rendering preserves run font sizes from the imported PPTX; it does not browser-shrink text when a text box is selected or resized.
- Resizing a text object does not inject `a:normAutofit`. When wrapped or edited text needs additional vertical space, the editor grows the text frame while preserving its width and formatting.
- During inline typing, frame-height growth is previewed locally with the selection frame and saved together with the text change as one undoable operation. Cancelling inline editing discards the preview.
- Table-cell text remains governed by the table grid; cell text does not independently resize the table.
- Inline editing preserves the imported paragraph line-height and font size so wrapped text metrics remain consistent; caret color is controlled separately.


### Text-frame resizing and wrapping reliability

Auto-fit measurement is suspended only during an active pointer drag/resize, not while the canvas is previewing an auto-grown text-frame height. This keeps the measurement callback active throughout inline typing, so adding more lines continues to grow the frame. During pointer previews, the prior measured dimensions are retained until the committed dimensions are available; otherwise a preview size could be mistaken for the committed baseline and the post-resize measurement would be skipped. Inline editing preserves imported paragraph line-height rather than overriding it to imitate a smaller caret, preventing mismatched text metrics and clipped wrapped lines.
