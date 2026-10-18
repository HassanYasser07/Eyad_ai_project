# Test Presentation Environment — PPTX Editor

Complete technical and user documentation for the presentation editing feature.

- **Feature name in the UI:** Test Presentation Environment
- **Entry point:** button in the Presentation Studio header (`src/pages/PresentationsStudio.jsx`)
- **Code:** `src/components/pptxEditor/` (UI) and `src/components/pptxEditor/engine/` (document engine, no React)
- **Scope:** import a real `.pptx`, edit individual slide objects, export an editable `.pptx`
- **Isolation:** the existing AI presentation-generation workflow is not modified. The editor is lazy-loaded as its own bundle chunk.

---

## Table of contents

1. [Summary](#1-summary)
2. [Installation and required steps](#2-installation-and-required-steps)
3. [Why this engine (research and decision)](#3-why-this-engine-research-and-decision)
4. [How it works](#4-how-it-works)
5. [File map](#5-file-map)
6. [Engine reference](#6-engine-reference)
7. [User interface](#7-user-interface)
8. [Platform behavior: web, Android, iOS](#8-platform-behavior-web-android-ios)
9. [Selection and canvas reliability](#9-selection-and-canvas-reliability)
10. [Import behavior and fidelity](#10-import-behavior-and-fidelity)
11. [Export behavior](#11-export-behavior)
12. [Drafts, undo, and data safety](#12-drafts-undo-and-data-safety)
13. [Security model](#13-security-model)
14. [Localization (English and Arabic)](#14-localization-english-and-arabic)
15. [Known limitations](#15-known-limitations)
16. [Licensing, infrastructure, and cost](#16-licensing-infrastructure-and-cost)
17. [Testing](#17-testing)
18. [What was and was not verified](#18-what-was-and-was-not-verified)
19. [Troubleshooting](#19-troubleshooting)
20. [Extending the editor](#20-extending-the-editor)
21. [Upgrade path to ONLYOFFICE](#21-upgrade-path-to-onlyoffice)
22. [Bugs found and fixed during development](#22-bugs-found-and-fixed-during-development)
23. [Editor enhancements in this update](#23-editor-enhancements-in-this-update)

---

## 1. Summary

Users open a `.pptx` from their device, edit real slide objects (text, shapes, images, table cells, groups), manage slides, and export a valid `.pptx` that stays editable in PowerPoint and similar software.

| Capability | Status |
|---|---|
| Import real slide structure (no screenshots) | Yes |
| Move / resize / rotate / flip objects | Yes |
| Edit text with run formatting preserved | Yes |
| Font, size, bold, italic, underline, strikethrough, text highlight, text colour, alignment, bullets, line spacing, anchor, autofit | Yes (whole-object scope; text-format commands are contextual) |
| Shape fill, outline colour/thickness/dash patterns, opacity | Yes (shape-specific controls) |
| Insert text box, categorized shape gallery, line, image; replace image | Yes; expanded to 44 insertable shape presets |
| Group / ungroup, align, distribute, z-order, layer visibility, layer ordering | Yes; object locks last for the editor session only |
| Table cell editing, add/delete row and column | Yes (not for tables with merged cells) |
| Add (with layout), duplicate, reorder, delete slides | Yes |
| Undo / redo (200 steps) | Yes |
| Copy / paste objects across slides | Yes (pictures and shapes) |
| Chart data editing | No — view-only preview |
| SmartArt / OLE / 3D editing | No — preserved, movable, deletable |
| Animations / transitions / notes | Preserved, not shown or editable |
| Desktop, phone web, Android app, iOS app | Same code; see section 8 for what was tested |
| Arabic / RTL interface | Yes |

---

## 2. Installation and required steps

### Files to add or replace in the project

**Add (new):**
- `src/components/pptxEditor/` (entire folder)
- `docs/PPTX_EDITOR.md` and this document
- `tests/pptx/` (entire folder, includes fixtures)
- `tests/e2e/` (optional — only needed to run browser tests)

**Replace (existing files modified):**
- `src/pages/PresentationsStudio.jsx` — adds the button, state, and lazy mount
- `src/i18n/translations.js` — adds `pptxEditor.*` keys (English and Arabic)
- `src/components/ui/drawer.jsx` — adds an optional `container` prop on `DrawerContent`
- `package.json` and `package-lock.json`

If any of the three source files changed in your project since this work was done, merge instead of overwriting; each change is small.

**Do not copy:** `node_modules/`, `dist/`, `.github/`, `.npmrc`, `vite.config.js` (these only appeared modified because of line-ending differences in the supplied archive).

### New dependencies

| Package | Type | Purpose |
|---|---|---|
| `@capacitor/filesystem` ^8.1.5 | runtime | write the exported file to the app cache on Android/iOS |
| `@capacitor/share` ^8.0.3 | runtime | open the OS share sheet for the exported file |
| `@xmldom/xmldom` ^0.9.12 | dev | run engine tests in Node (browsers use the built-in DOMParser) |

The project `.npmrc` blocks packages published in the last 7 days; all versions above satisfied that rule at install time.

### Required commands

```bash
npm install
npx cap sync        # registers the two Capacitor plugins in the Android and iOS projects
npm run build
```

Without `npx cap sync`, exporting inside the native apps will fail. The web build is unaffected.

### Recommended (not applied — global change)

Add `viewport-fit=cover` to the `<meta name="viewport">` tag in `index.html`. Without it, iOS may report `0` for `env(safe-area-inset-*)`. The editor uses `max(env(...), fallback)` everywhere, so it remains usable either way.

---

## 3. Why this engine (research and decision)

The brief required choosing a mature engine rather than building one, and warned against assuming a library works because it renders slides. Each candidate was checked against its actual code or documentation.

| Candidate | Verified finding | Verdict |
|---|---|---|
| **SlideWise** (MIT) | Peer dependency `react >=19`; the app uses React 18. Its canvas and selection frame use only `mousedown/mousemove/mouseup` — no pointer events, no `touch-action`, no pinch handling — so touch drag, resize, and rotate cannot work. Its own changelog describes its serialize round-trip as lossy; its lossless path (`applyEdits`) covers only a few operations. | Rejected: mobile and framework incompatibility |
| **ONLYOFFICE Docs** | Strongest engine (PPTX is its native format) with mobile web editors, but those are only in the proprietary Developer/Enterprise editions. Community Edition is AGPL-3.0 without mobile web editors. Requires a self-hosted Document Server, a storage and callback service, a JWT secret, and a license. The Developer pricing page listed a starting configuration of $3,500 (verify with the vendor). | Best option for full fidelity, but requires paid infrastructure that was not provisioned |
| **Univer Slides** | PPTX import/export is a Pro feature that needs a Univer Server conversion backend; unlicensed use shows a watermark. Mobile behavior for Slides was not verified. | Rejected: needs paid backend |
| **PPTist** | Vue (not React); AGPL-3.0; its author rates its own PPTX import fidelity at roughly 70–80%. | Rejected |
| **PptxGenJS, viewers, `pptx-react-viewer`** | Generators or viewers, not editors of existing decks. `pptx-react-viewer` was excluded by the brief. | Not editing engines |

**Conclusion:** no free, local engine met import + edit + export + touch together. Rather than stop, the editor edits the OOXML package directly (section 4). The same principle is what SlideWise moved toward after finding its round-trip lossy.

Research caveats: the GitHub API was rate-limited from the sandbox, so SlideWise was verified by cloning and reading its code. ONLYOFFICE and Univer findings come from their documentation and pricing pages as found at research time; re-verify before relying on them.

---

## 4. How it works

### Core principle: edit the package, do not regenerate it

A `.pptx` is a zip of XML parts. The editor:

1. Opens the zip and preloads all XML text.
2. Builds a **read-only view model** of each slide from the slide XML plus its layout, master, and theme.
3. Applies each user action as an **operation that mutates the real slide XML** inside a transaction.
4. Re-derives the view model from the XML after every change, so the canvas can never drift from the document.
5. On export, writes edited parts and **copies every other part byte-for-byte** from the original archive.

Consequences: masters, layouts, themes, notes, embedded fonts, charts, SmartArt, untouched slides, and animations on untouched slides survive exactly.

### Data flow

```
.pptx bytes ─▶ PptxPackage.open (validate, preload XML)
                    │
                    ▼
             readPresentation / readSlide ──▶ view model ──▶ SlideView (render)
                    ▲                                           │
                    │                                           ▼
             ops.* / slides.* (transactions) ◀── Canvas (pointer input) / Inspector / toolbars
                    │
                    ▼
             PptxPackage.exportBytes ──▶ .pptx (edited parts + byte-identical rest)
```

### Transactions and history

Every public operation runs through `pkg.transact(label, fn)`:
- Before the first mutation of a part in the transaction, its serialized text is recorded.
- On commit, the new serialized text is recorded and one history entry is pushed.
- On an exception, everything is rolled back.
- Undo/redo restores recorded text. After undoing back to the original, the part's text is the **exact original string**, so it is byte-identical again.
- Added binary parts (images) are held in memory; unreachable ones are pruned at export.
- History depth: 200 steps.

---

## 5. File map

### UI — `src/components/pptxEditor/`

| File | Responsibility |
|---|---|
| `PptxEditorDialog.jsx` | Full-screen dialog; start screen; desktop and phone layouts; all actions; keyboard shortcuts; autosave; export; confirmation dialogs |
| `Canvas.jsx` | Interactive stage: zoom/pan, pointer-event gesture state machine, hit-testing, snapping, selection overlay, handles |
| `SlideView.jsx` | Pure renderer of a slide model (canvas and thumbnails): shapes via SVG, text, pictures with crop, tables, chart preview |
| `Inspector.jsx` | Contextual properties: slide background, appearance, text, position, image, table, arrange, layers |
| `Sheets.jsx` | Non-modal bottom sheet, text-editing sheet, slide thumbnails panel, `visualViewport` hook |
| `Controls.jsx` | Buttons, color field, number field, slider field, section |
| `fileIO.js` | File checks and picker, native/web save and share, IndexedDB drafts, image info |
| `useMediaUrls.js` | Blob URLs for media parts, cached per package |
| `pptxEditor.css` | All editor styles, using the app's design tokens |

### Engine — `src/components/pptxEditor/engine/`

| File | Responsibility |
|---|---|
| `xml.js` | Namespace-aware XML helpers, parse/serialize, schema-order insertion tables, `PptxError` |
| `package.js` | Zip validation, transactions, undo/redo, relationships, content types, integrity validation, byte-preserving export with pruning |
| `theme.js` | Theme colors and fonts, color transforms (`lumMod`, `lumOff`, tint, shade, alpha, `satMod`), color-map handling |
| `shapes.js` | Preset geometry and `custGeom` to SVG paths |
| `slideModel.js` | View model: placeholder inheritance, text style chain, fills/lines, groups, tables, charts, duplicate-safe keys |
| `geometry.js` | Pure math: rotated bounds, union, hit-test, align, distribute, snapping |
| `ops.js` | Object operations (each one undoable transaction) |
| `slides.js` | Slide add / duplicate / delete / reorder, layouts, background colour/reset |
| `index.js` | Public exports |

### Tests and docs

| Path | Content |
|---|---|
| `tests/pptx/engine.test.js` | Engine tests (Node), including background round-trip/undo and shape-gallery coverage |
| `tests/pptx/make_fixtures.py` | Builds fixtures with python-pptx |
| `tests/pptx/fixtures/` | `simple`, `overlap`, `table_chart`, `text_heavy_4x3`, `many_slides`, `libreoffice_overlap`, `pptxgenjs_rich` |
| `tests/pptx/make_edited.mjs` | Writes edited exports for third-party validation |
| `tests/pptx/robustness.mjs` | Runs an edit battery over any decks |
| `tests/e2e/` | Browser suites, `run.sh` runner, shared helpers, dev-only harness in `harness/` |

---

## 6. Engine reference

### 6.1 Package layer (`package.js`)

**Open** (`PptxPackage.open(bytes, { fileName })`) rejects, with a typed `PptxError`:

| Code | Cause |
|---|---|
| `EMPTY_FILE` | zero bytes |
| `FILE_TOO_LARGE` | over 100 MB |
| `LEGACY_OR_ENCRYPTED` | OLE signature (legacy `.ppt` or password-protected) |
| `NOT_A_ZIP` | missing `PK` signature |
| `ZIP_CORRUPT` | zip cannot be read |
| `TOO_MANY_ENTRIES` | more than 10,000 entries |
| `PART_TOO_LARGE` | an XML part over 30 MB |
| `ZIP_BOMB` | total uncompressed size over 600 MB |
| `NOT_PPTX` | missing `[Content_Types].xml` or `ppt/presentation.xml` |
| `MACRO_ENABLED` | macro content type or `ppt/vbaProject.bin` present |
| `XML_DOCTYPE` | an XML part contains DOCTYPE/ENTITY |
| `XML_PARSE` | malformed XML |

**Key members:** `doc(path)`, `bytes(path)`, `readRels(part)`, `transact`, `edit(path)`, `createPart`, `putBinary`, `deletePart`, `addRel`, `removeRel`, `ensureDefault`, `setOverride`, `removeOverride`, `undo`, `redo`, `canUndo`, `canRedo`, `isDirty`, `markSaved`, `subscribe`, `rev(path)`, `validate()`, `exportBytes()`.

**`validate()`** reports structural problems that make PowerPoint show a repair prompt: relationships pointing to missing parts, orphan relationship files, content-type overrides for missing parts, parts with no content type.

**`exportBytes()`:**
- Edited parts are written from the serialized text; all others are copied byte-for-byte.
- Parts unreachable from the root relationships are pruned if they were added during the session, or (for any part) if a slide was deleted.
- Content-type overrides for pruned parts are removed, which also repairs dangling overrides present in some source files (PptxGenJS output has them).
- `[Content_Types].xml` is written first.

### 6.2 View model (`slideModel.js`)

`readPresentation(pkg)` → `{ size, slides: [{ id, rId, path }], defaultTextStyle }`.

`readSlide(pkg, slidePath)` → `{ path, layoutPath, masterPath, size, background, under, elements, warnings, theme }`.

- **Placeholder inheritance:** geometry, text style, anchor, fill, and line are resolved slide → layout → master (matching by `idx`, then type).
- **Text style chain:** shape `lstStyle` → layout placeholder `lstStyle` → master placeholder `lstStyle` → master `titleStyle/bodyStyle/otherStyle` → presentation `defaultTextStyle`. Per level 1–9. Bullets (char and auto-number), spacing, line spacing, `normAutofit fontScale`, run properties, highlight, superscript/subscript, hyperlink styling, paragraph `rtl`.
- **Fills and lines:** solid, gradient (linear/radial), pattern (approximated to solid), picture; line width, dash, arrow ends; `p:style` references (`fillRef`, `lnRef`, `fontRef`) are resolved.
- **Groups** are flattened to absolute slide coordinates (nested transforms, scale, rotation, flips). A group is selected as one object.
- **Tables:** columns, rows, merges, cell text, cell fill; table style is approximated (header color, banding).
- **Charts:** type, title, and cached series data for bar/column/line/pie preview.
- **Layout/master artwork** is drawn behind the slide (respecting `showMasterSp`).
- **Warnings:** `chart-view-only`, `smartart-view-only`, `object-view-only`, `alternate-content`, `geometry-approximated`, `external-image`, `image-format`.
- **Duplicate shape ids** (present in PptxGenJS output) get unique keys `id~n` by occurrence order. The same scheme is used by the operations.

### 6.3 Operations (`ops.js`)

Each function runs as one undoable transaction. All XML children are inserted in schema order.

| Function | Effect |
|---|---|
| `setBounds(pkg, slide, changes, label)` | Write position, size, rotation, flips; materializes inherited placeholder geometry |
| `deleteElements` | Remove objects; removes the slide's animation timeline if a deleted object was animated |
| `duplicateElements` | Clone with fresh ids, offset, on top |
| `reorderElements(…, mode)` | `front`, `back`, `forward`, `backward` |
| `setText(…, texts, cell?)` | Edit paragraph text by minimal prefix/suffix diff so run formatting survives; add/remove paragraphs |
| `setTextProps(…, props, cell?)` | `size, bold, italic, underline, color, font, align, bullet, lineSpacing, anchor, wrap, autofit` over the whole object |
| `setShapeStyle` | Fill (solid/none, alpha), outline (color, width, dash, none) |
| `setOpacity` | Fill alpha for shapes; `alphaModFix` for pictures |
| `addTextBox`, `addShape`, `addPicture` | Insert objects; picture adds media part, relationship, and content-type default |
| `replacePicture` | Adds a new media part (never overwrites media shared by other slides) |
| `groupElements`, `ungroupElement` | Group with identity child mapping; ungroup applies scale, rotation, flips |
| `tableRows`, `tableCols` | Add/delete; refused for tables with merged cells; removes cloned row/column ids |
| `copyElements`, `pasteElements` | Across slides, remapping image/hyperlink relationships; charts, SmartArt, embedded objects are refused |
| `setElementName`, `setAltText` | Metadata |

Supported insert shapes: `rect`, `roundRect`, `ellipse`, `triangle`, `rightArrow`, `star5`, `line`.

### 6.4 Slide operations (`slides.js`)

| Function | Notes |
|---|---|
| `listLayouts` | Layout names from the master(s) |
| `addSlide(pkg, afterIndex, layoutPath)` | Creates a slide with empty text placeholders from the layout |
| `duplicateSlide(pkg, index)` | Async. Copies the slide; deep-copies exclusive parts (charts, workbooks, diagrams) with new names; shares images/layouts; **drops notes** |
| `deleteSlide(pkg, index)` | Removes the slide, its relationships, notes, and overrides; orphaned parts pruned at export; last slide cannot be deleted |
| `moveSlide(pkg, from, to)` | Reorders the slide list |

Any structural change removes PowerPoint **sections** from `presentation.xml`, because PowerPoint shows a repair prompt when sections disagree with the slide list.

### 6.5 Geometry helpers (`geometry.js`)

`rotatedBox`, `unionBox`, `hitTest`, `computeAlign`, `computeDistribute`, `snapBox`. Pure functions, unit-tested.

---

## 7. User interface

### 7.1 Start screen
- Open button (system file picker) and drag-and-drop on web.
- "Unsaved work found" card with **Resume** / **Discard** when a draft exists.
- Summary of what is supported and the known limits.
- Error toast for rejected files.

### 7.2 Desktop workspace
- **Top bar:** close, file name, unsaved indicator, undo/redo, fit/zoom, grid/snap, reset to original, import report, presentation preview, and export.
- **Ribbon:** `Home`, `Insert`, `Design`, contextual `Text`, contextual `Shapes`, contextual `Image`, and `View`. The contextual tabs auto-select when a single compatible object type is selected. Controls are disabled for incompatible selections.
- **Left:** slide thumbnails with selection, reorder, duplicate, delete, and layout-based slide insertion.
- **Center:** editable slide canvas; presentation preview uses the same slide rendering without selection handles.
- **Right utility sidebar:** only `Arrange` and `Layers`. Arrange owns universal position/size, precise nudging, rotation, flip, align/distribute and grouping commands. Layers owns visibility, session locks and stacking/reordering commands. Text, shape and image formatting are not duplicated in this sidebar.
- **Footer:** slide counter and keyboard shortcut hint.

### 7.3 Keyboard shortcuts (desktop)

| Shortcut | Action |
|---|---|
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y | Redo |
| Ctrl/Cmd+S | Export |
| Ctrl/Cmd+A | Select all |
| Ctrl/Cmd+D | Duplicate |
| Ctrl/Cmd+C / V | Copy / paste objects |
| Ctrl/Cmd+G / Shift+G | Group / ungroup |
| Ctrl/Cmd+] / [ | Bring forward / send backward (add Shift for front/back) |
| Ctrl/Cmd+0, +, − | Fit, zoom in, zoom out |
| Delete / Backspace | Delete selection |
| Arrow keys (Shift = ×10) | Nudge 1 px (96-dpi) |
| Enter | Edit text of the selected object |
| Esc | Close confirm → drawer → sheet → clear selection (never closes the editor) |
| PageUp / PageDown | Previous / next slide |
| Alt + click | Select the object behind |
| Shift/Ctrl/Cmd + click | Add/remove from selection |
| Ctrl/Cmd + wheel | Zoom at cursor |

### 7.4 Phone layout
- **Top bar:** close, file name, undo/redo, presentation preview, export, and overflow actions.
- **Canvas:** fills the available space; its measured size updates as the viewport or utility sheets change.
- **Slide pill:** previous / slide count / next; tapping the counter opens the slide picker.
- **Bottom navigation:** Home, Insert, Design, Text, Shapes, Image, Arrange, Layers, Slides and View. Arrange/Layers opens a bounded utility sheet with an in-sheet tab switch. Contextual text, shape and image selection opens the matching section after a short delay; the delay is cancelled during drags and text-entry gestures.
- **Sheets:** command sheets have a maximum height of 72dvh and their own vertical scrolling. A text-entry sheet remains separate from formatting controls, so double-tap editing does not get interrupted by the contextual ribbon.
- **Slides drawer:** modal slide grid with actions, kept separate from the editor command sheets.
- **Presentation Preview:** fullscreen slide view with previous/next touch controls and keyboard navigation when available.
- **Short landscape screens:** toolbar can become icon-only; the bottom bar and sheets account for safe-area insets.

### 7.5 Contextual editing and utility panels

| Section | Controls and availability |
|---|---|
| Design | Solid background colour on the active slide, **Apply current background to all slides**, reset active background to theme, and reset all backgrounds to theme. The all-slides action is explicit and single-step undoable; gradient/picture backgrounds are not silently flattened. |
| Text | Insert/edit/delete text boxes; font family/size, bold, italic, underline, strikethrough, font colour, text highlight, paragraph alignment and bullets. Formatting is whole-object style, not character-range formatting. Table selections route to Text but use the dedicated table editor. |
| Shapes | Full categorized searchable gallery; fill/no-fill, outline colour/width, eleven dash patterns, opacity where supported, flips, duplicate and delete. Fill controls are unavailable for lines; all shape-format controls are disabled without a compatible unlocked shape selection. |
| Image | Replace image, opacity, alt text, duplicate and delete. Alt text is only editable for one selected image; image actions disable for incompatible or locked selections. |
| Arrange (utility sidebar/sheet) | Four 1-point nudge arrows, X/Y/width/height, interactive rotation wheel with angle presets, flip, alignment/distribution, group/ungroup, duplicate/delete and select-behind. General actions skip locked or read-only objects. |
| Layers (utility sidebar/sheet) | One card per object, topmost first; select, show/hide, session lock/unlock, drag reorder and explicit layer-order commands. Hiding is saved to DrawingML and hidden objects do not render in canvas or preview. Locks are session-only. |
| Table editor | Editable table-cell grid, add/delete rows and columns. Opened from a selected table in Text. |
| View | Zoom in/out, Fit to Screen, presentation preview, grid/snap, diagnostics and multi-select. |

Position fields use points (1 pt = 12,700 EMU). On phones, the desktop utility sidebar becomes a bounded, scrollable bottom sheet rather than a full-height drawer.

---

## 8. Platform behavior: web, Android, iOS

### 8.1 Architecture

The project uses **Capacitor 8**. The Android and iOS apps load the same built web bundle in a WebView (Android WebView / iOS WKWebView). There is no separate native editor, so the same React code serves all four targets: desktop web, mobile web, Android app, iOS app. The layout switches by media query (`max-width: 767px`, or `max-height: 520px` with a coarse pointer).

### 8.2 Differences by platform

| Concern | Web | Android / iOS app |
|---|---|---|
| Open file | `<input type=file>` with `.pptx` and MIME type; drag-and-drop on desktop | Same input (system document picker); MIME type is listed because Android pickers grey out unknown extensions |
| Save | Web Share (files) on touch browsers when available, else `<a download>` | Write to app cache with `@capacitor/filesystem`, then open `@capacitor/share` sheet (`<a download>` is unreliable in WKWebView) |
| Keyboard | — | Root height follows `visualViewport`; sheet and Done button stay inside the visible area |
| Safe areas | — | Top bar, bottom bar, and sheet footers use `max(env(safe-area-inset-*), fallback)` |
| Background/kill | `visibilitychange`, `pagehide` | Draft flushed immediately when hidden; draft offered on next open |

### 8.3 Touch interaction model

- **Tap** selects the visible top object. **Double-tap** an object edits its text. **Double-tap empty canvas** toggles fit / zoom-in; from any non-fit zoom it returns to fit.
- **Drag** a selected object moves it. Pressing inside the selection drags *that* object even if another covers it; a plain tap selects whatever is visibly on top.
- **Handles:** 8 resize + 1 rotate, each with a 44 × 44 px hit area and a 16 px visible knob on touch. On small frames, side handles are hidden on the axis that is too small, leaving corners.
- **Pinch** zooms (50%–800%) around the pinch center; **two-finger drag** pans; **one-finger drag on empty canvas** pans.
- A second finger landing during a one-finger drag **cancels** the drag. Selection changes only on tap or when a drag actually starts, so starting a pinch on an object does not change selection.
- The stage uses `touch-action: none` and blocks iOS `gesture*` events, so browser scroll/zoom never competes with the canvas. Toolbars and sheets are outside the stage and scroll independently.
- **Multi-select mode** (toolbar toggle): taps add/remove objects. **Select behind** button and **Layers** list reach covered objects.

---

## 9. Selection and canvas reliability

These were the highest-priority requirements. Design and evidence:

| Requirement | How it is met |
|---|---|
| Frame and handles visible above the selected object | They are in a separate **screen-space overlay layer** above the slide (`z-index: 20`), not inside the object. Tested: the element at each handle's position is the handle, for every picture. |
| Content must not obscure its own controls | Same mechanism; also holds mid-drag. |
| Overlapping objects remain selectable | Geometric hit-testing over rotated boxes (not DOM), Alt+click, "Select behind", Layers list, tap-selects-topmost. |
| Handles correct under zoom/resize | Overlay positions are computed from the view transform; handle size is constant in screen pixels. |
| Dragging must not select another object | Press inside the selection arms a drag of the selected object. |
| Touch must not conflict with scroll/pinch/navigation | `touch-action: none`, pointer-event state machine, deferred selection, drag cancel on second finger; slide navigation is by explicit buttons. |
| Frame tracks object during move and rotation | Live draft bounds drive both the object preview and the frame. Groups are previewed with a CSS transform so content and frame stay together. Tested mid-drag. |
| Selecting edits the real document | Operations write XML; the canvas is re-read from the XML. |
| Rotated/transformed/nested objects | Resize math works in the object's local axes; nested groups are flattened with composed transforms. |

**Snapping:** while dragging, objects snap to slide edges/center and other objects' edges/centers within 6 screen pixels; grid snapping is optional; hold Alt to bypass. Pink guide lines show active snaps. Resize does not snap.

---

## 10. Import behavior and fidelity

### What is imported as editable objects
Text boxes, placeholders, shapes (preset and custom geometry), lines/connectors with arrowheads, pictures (crop, opacity, rounded masks), groups, tables.

### What is preserved but not editable
Charts, SmartArt, OLE objects, 3D/equation (`mc:AlternateContent`), animations, transitions, notes, hyperlinks, sections (until a structural change), embedded fonts, slide masters and layouts.

### Import report
After opening, **Import report** (desktop top bar, phone More menu) lists limitations grouped by type with slide numbers, notes sections behavior, and any structural issues found in the original file. A file with no limitations says so.

### Fidelity comparison method
Rendering was compared side by side with LibreOffice for the PptxGenJS deck (layout, rotation, transparency, mixed runs, bullets, picture, table matched closely). Differences found and addressed: arrowhead size (now matches 3× line width), serif/monospace font fallbacks, paragraph RTL direction, chart placeholder (now a labeled preview). Remaining differences: charts are a simplified preview; some preset shapes are drawn as rectangles; table styles and pattern fills are approximated.

Fonts: text uses fonts installed on the viewing device. Serif and monospace families fall back to a serif or monospace generic.

---

## 11. Export behavior

1. Click **Export** (or Ctrl/Cmd+S).
2. The engine serializes edited parts, copies the rest byte-for-byte, prunes orphaned parts, repairs content types, and zips.
3. `validate()` runs; if structural issues remain the user sees a warning with the count (the file is still delivered).
4. The file is named `<original>-edited.pptx`.
5. Delivery: native share sheet (apps), Web Share or download (web).
6. On success the unsaved marker clears and the draft is deleted. Cancelling the share sheet does not mark the document saved.

**Not rasterized:** slides are never converted to images.

**Verified by independent tools** (not just by the editor): python-pptx opens every edited export; the OOXML schema validator reports no new errors against the originals; LibreOffice renders the edits correctly; exports re-open in the editor.

---

## 12. Drafts, undo, and data safety

- **Autosave:** about 1.2 s after an edit, and immediately when the page becomes hidden or `pagehide` fires. Stored in IndexedDB (`eyad-pptx-editor`, store `drafts`, key `current`): file name, edited bytes (uncompressed zip), the original bytes, timestamp. One draft at a time.
- **Resume:** offered on the next open; a resumed draft is marked unsaved. History is **not** restored.
- **Unsaved warning:** closing with unsaved changes asks for confirmation; `beforeunload` also warns on web.
- **Reset to original:** reloads the kept original bytes after confirmation. Works after resuming a draft.
- **Undo/redo:** one step per gesture or operation; 200 steps.
- **Locks:** editor-session only; not written to the file.

---

## 13. Security model

Uploaded files are treated as untrusted.

| Threat | Mitigation |
|---|---|
| Wrong file type / disguised file | Extension check, zip signature check, content-type and presentation-part checks |
| Oversized or zip-bomb files | 100 MB file limit; entry-count, XML-part, and total uncompressed limits |
| Macros / executable content | Macro-enabled files rejected; macros are never run |
| Legacy/encrypted files | Detected by OLE signature; clear message |
| XML entity expansion | Any XML part with `DOCTYPE`/`ENTITY` is rejected |
| External resources | External linked pictures are not loaded; hyperlinks are not followed |
| Script injection | All slide text rendered as React text nodes (no `innerHTML`); colors validated as 6-digit hex; font names sanitized; images limited to PNG/JPEG/GIF on insert |
| Data exposure | Everything runs on the device; nothing is uploaded; no keys or secrets are involved |

Insert limits: images up to 25 MB; inserted image formats PNG, JPEG, GIF.

---

## 14. Localization (English and Arabic)

- Keys: `pptxEditor.*` in `src/i18n/translations.js` (172 keys referenced by the UI, English and Arabic, none missing — verified by a key-extraction script, including dynamically built keys).
- Error messages are mapped by error code (`pptxEditor.err.<CODE>`); internal-only codes show a generic translated message, never raw English.
- RTL: the editor root takes the app direction; panels and sheets mirror; the text-editing textarea is RTL-aware; slide paragraphs honor `rtl`. The canvas itself always stays left-to-right so slide geometry is never mirrored.

---

## 15. Known limitations

**Content**
- Charts: view-only preview for bar, column, line, and pie from cached data; data and formatting cannot be edited; other chart types show a labeled placeholder.
- SmartArt, OLE, 3D/equation: preserved; can be moved, resized (where geometry is available), or deleted; not displayed or editable.
- Preset shapes offered in the insert gallery are rendered in the editor; unsupported preset geometries imported from third-party decks may still be approximated as rectangles (the file keeps the real geometry). Slide backgrounds support solid colours only. Gradients and picture fills on shapes, pattern fills, and table styles are approximated. EMF/WMF and externally linked pictures are not displayed.

**Editing**
- Format buttons apply to the whole object, not to a selected word range.
- Edited paragraphs keep the formatting of the run where the change occurred; unedited paragraphs keep all run formatting. Soft line breaks display as U+2028.
- Group children cannot be selected individually; ungroup first.
- Table row/column changes are unavailable for tables with merged cells; the editor adds/deletes the last row or column.
- Resize does not snap. Cropping, flip of pictures through handles, and picture transparency beyond opacity are not offered.
- Locks are session-only.

**Structure**
- Add/duplicate/delete/reorder slides removes PowerPoint sections.
- Duplicating a slide drops its notes.
- Deleting an animated object removes that slide's animation timeline.
- Copy/paste between slides supports pictures and shapes; charts, SmartArt, and embedded objects are refused.
- Undo history is not restored from a draft.

**Platform**
- Native save/share requires `npx cap sync` and was not tested on a device.
- One draft is stored at a time.

---

## 16. Licensing, infrastructure, and cost

For the delivered editor:

| Item | Requirement |
|---|---|
| License of new code | Part of your application |
| Third-party runtime additions | `@capacitor/filesystem`, `@capacitor/share` (Capacitor plugins). License terms of these packages should be confirmed against their package metadata in your compliance process. `jszip` was already a dependency. |
| Backend / document server | None |
| Conversion service | None |
| Paid external services | None |
| Storage | Device only (IndexedDB drafts) |
| Platform-specific native work | `npx cap sync` |

For the alternatives that were evaluated, see section 3; ONLYOFFICE would add a paid license, a Document Server host, a storage/callback endpoint, and a server-side JWT secret.

---

## 17. Testing

### Commands

```bash
npm run test:pptx      # engine tests (Node)
npm run test:reliability   # pre-existing tests

# Browser suites (need Python + Playwright + local Chromium; set CHROME_PATH if needed):
tests/e2e/run.sh tests/e2e/desktop.py tests/e2e/desktop_content.py \
                 tests/e2e/mobile.py tests/e2e/mobile_text.py tests/e2e/rtl.py
```

`run.sh` starts Vite, runs the scripts, and always stops the server. The editor is mounted by a dev-only harness (`tests/e2e/harness/`) that is outside `src/` and not part of the build.

### Suites

| Suite | What it covers |
|---|---|
| `engine.test.js` | open/validate all fixtures; byte-identical untouched export; placeholder inheritance; groups; tables/charts; move/resize/rotate and undo; text edit with formatting; schema-ordered properties; delete/duplicate/reorder/group/ungroup; insert text/shape/picture; table rows/columns; slide add/duplicate/move/delete; chart deep copy; pruning; hostile input; align/distribute/hit-test; copy/paste; LibreOffice and PptxGenJS decks; RTL; duplicate ids; single- and all-slide backgrounds; full preset shape gallery; outline dash patterns |
| `desktop.py` (42) | handle layering, frame alignment, overlap selection rules, select behind, mid-drag tracking, resize aspect, rotate, numeric fields, keyboard, zoom, multi-select/group, export and third-party validation, re-import |
| `desktop_content.py` (48) | text edit/format preservation/undo/cancel, inspector formatting, insert text/shape/image, slide operations, table editing, chart preview, export validation, hostile files, unsaved warning, reset, draft recovery, accessibility names |
| `mobile.py` (41 × 2 phone sizes = 82) | layout and touch targets, tap/drag/resize/rotate by touch, tap vs drag on overlap, select behind, pinch, two-finger pan, double-tap fit, drag cancel on second finger, drawer, sheets, multi-select, export |
| `mobile_text.py` (34) | safe areas, text mode with keyboard-sized viewport, dismiss keyboard keeping text, rotation to landscape, background flush, WebView-kill recovery, table editing in sheet |
| `rtl.py` (12) | Arabic interface on desktop and phone, RTL text editor, RTL slide paragraphs |
| Production smoke (8) | core flow against the minified production bundle on desktop and phone |

### Verification for the current editor update (2026-10-18)

- PPTX engine suite: **29 / 29 passed** (`npm run test:pptx`), including the new single-slide and all-slide background tests, the full shape gallery, and all 11 outline dash presets.
- Reliability suite: **17 / 17 passed** (`npm run test:reliability`).
- Syntax checks: the modified editor UI, inspector, engine, translations, and test files transpiled without syntax errors.
- Localization audit: all newly added shape, background, and outline-style labels are present in both English and Arabic.
- Full Vite build, lint, project typecheck, and browser suites: **not successfully verified in this run**. Dependency installation could not complete because the npm registry lookup failed with `EAI_AGAIN`; the build reported `vite: not found`, lint reported `eslint: not found`, and typecheck could not resolve required React/application packages. This means those checks cannot establish whether the updated app builds cleanly here.
- Android/iOS physical-device and native save/share validation: not performed in this environment. Complete dependency installation and run `npx cap sync` before native release testing.

The earlier baseline below records results from the repository's previous verification, before the current editor additions; it is not a claim that those suites were rerun for this update.

- Previous engine baseline: 25 / 25
- Previous desktop browser baseline: 90 / 90
- Previous phone touch-emulation baseline: 116 / 116
- Previous RTL baseline: 12 / 12
- Previous production-bundle baseline: 8 / 8
- Previous reliability baseline: 17 / 17
- Earlier recorded lint state: one unused import in `LogoStudioDesktop.jsx`

Third-party validation described above was part of the earlier recorded baseline; no external PowerPoint application or physical mobile device was available for this update's validation.

---

## 18. What was and was not verified

The browser and production-bundle statuses in this table are from the earlier recorded baseline. The current update-specific verification and dependency-install blocker are documented in Section 17 above.

| Target | How tested | Status |
|---|---|---|
| Desktop web (Chromium) | Automated browser tests | Verified |
| Mobile web (phone viewports) | Automated, Chromium **touch emulation** with real touch events (including two-finger pinch) | Verified in emulation |
| Production bundle | Automated browser tests on the minified build | Verified |
| Android app / Android WebView | — | **Not tested** |
| iOS app / WKWebView / iOS Safari | — | **Not tested** |
| Physical devices | — | **Not tested** |
| Native save/share path | — | **Not tested** (requires Capacitor and `cap sync`) |
| Real PowerPoint | — | **Not tested** (validated with python-pptx, schema validator, LibreOffice) |
| Real-world decks from PowerPoint/Keynote/Google Slides | — | **Not tested**; fixtures came from python-pptx, LibreOffice, and PptxGenJS |
| Safe areas | CDP safe-area override in Chromium | Verified in emulation only |
| Software keyboard | Simulated by shrinking the viewport | Verified in emulation only |

Recommended before release: test on at least one physical Android phone and one physical iPhone (file open, text editing with the real keyboard, pinch, export through the share sheet), and open several exported files in desktop PowerPoint.

---

## 19. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Exporting inside the Android/iOS app does nothing or errors | `npx cap sync` not run, or the app was not rebuilt after installing the plugins |
| Message "legacy .ppt or password-protected" | The file is an old `.ppt` or encrypted; save as an unprotected `.pptx` |
| Message "Macro-enabled files are not supported" | The file is `.pptm`; save as `.pptx` |
| A chart shows a labeled preview or gray card | Expected; charts are view-only (section 15) |
| An object looks like a rectangle but the shape is different | Preset not implemented in the editor renderer; the file keeps the true shape. See the import report. |
| Fonts look different | The viewing device does not have the font |
| Safe-area padding looks missing on iOS | Add `viewport-fit=cover` to `index.html` (section 2) |
| Import report shows "structural issues in the original file" | The source file has defects such as dangling content-type entries; export prunes dangling entries |
| Sections disappeared after adding or reordering slides | Expected (section 6.4) |
| "Unsaved work found" appears next time | A draft was autosaved; Resume or Discard |
| Cannot select an object hidden behind another | Use Alt+click, **Select behind**, or the Layers list |
| Browser tests cannot start | Set `CHROME_PATH`; install Playwright for Python |
| Test Presentation editor fails to open | Update `Inspector.jsx` and `PptxEditorDialog.jsx` together; the contextual layer icons and formatting controls must be imported. The Presentation Studio now shows loading/error feedback instead of silently rendering a blank view. |

---

## 20. Extending the editor

**Add a new object operation**
1. Implement it in `engine/ops.js` using `mutateSlide(pkg, slidePath, label, (doc, tree) => …)`; use `insertOrdered` with the schema order tables in `xml.js` for any new child element.
2. Address objects with `findNode` / `keyedNodes` (duplicate-safe keys), not raw ids.
3. Add an engine test that also checks `validate()` and a round-trip export.
4. Expose it in `Inspector.jsx` or the toolbars through the `actions` object in `PptxEditorDialog.jsx`.
5. Add translation keys for English and Arabic; run the key-check script pattern from section 14.

**Add a preset shape to the renderer**
Add a `case` in `engine/shapes.js` `presetGeometry` returning `{ kind: "path", d }` in the shape's pixel box.

**Add an insertable shape**
Add its preset to `SHAPE_PRESETS` in `ops.js`, add the geometry case in `shapes.js` if not already supported, add it to the shape gallery in `PptxEditorDialog.jsx`, then add English and Arabic `pptxEditor.shape.*` keys.

**Support another chart type preview**
Extend `chartPreview` in `slideModel.js` and `ChartPreview` in `SlideView.jsx`.

**Rules to keep**
- Never mutate XML outside a transaction.
- Never regenerate unedited parts.
- Keep selection overlays in screen space above the slide.
- Do not use `innerHTML` with document content.

---

## 21. Upgrade path to ONLYOFFICE

If full fidelity (chart data editing, SmartArt, complete rich-text range editing, animations) is required, replace the editor behind the same button with ONLYOFFICE Docs Developer Edition.

What it requires:
- A Developer (or Enterprise) license that includes mobile web editors.
- A self-hosted Document Server (Docker) reachable over HTTPS from the web app and the native WebViews. Base44 cannot host it.
- A storage endpoint to serve the file and a callback endpoint to receive saves.
- A server-side JWT secret; it must never be placed in client code.
- Embedding with the official React component in a WebView (Android WebView / iOS WKWebView) with the mobile editor view.
- A review of cross-origin, cookie, and content-security settings for the WebViews.

Migration notes: the button, lazy mount, localization pattern, and file picker flow can be reused; the engine, canvas, and inspector would be replaced by the vendor editor. Keep the current editor available as a no-infrastructure fallback if desired.

---

## 22. Bugs found and fixed during development

Testing against real browser behavior and foreign-writer files found these defects, all fixed and covered by tests:

| Bug | Impact | Fix |
|---|---|---|
| Tapping an object covered by another did not select it when something below was already selected | Overlapping objects unreachable by tap | Press inside selection arms drag; a tap selects the visible top object |
| First finger of a pinch selected the object under it | Accidental selection change during zoom | Selection is deferred until tap or drag start |
| Escape closed the whole editor (including while the slides drawer was open) | Risk of losing the workspace | Escape only dismisses the topmost layer and never closes the editor |
| Upload errors invisible on the start screen | Failed imports gave no feedback | Toast renders in both phases |
| Canvas collapsed to 0 px height while typing on a phone | Could not see the text being edited | Bottom toolbar hidden during text mode |
| Bottom toolbar overflowed on 390 px phones | Primary action clipped | Buttons share width evenly |
| Landscape layout cramped; slide pill covered selection; side handles overlapped on small objects | Hard to use | Icon-only landscape toolbar, pill moved to corner, side handles hidden on small axes |
| Double-tap on empty canvas zoomed in further when already zoomed out | Confusing | Returns to fit from any non-fit zoom; minimum zoom 50% |
| Slide deletion left a content-type override for the slide's `.rels` (LibreOffice-written files) | Invalid package entry | Deleting any part removes its override |
| Duplicate shape ids (PptxGenJS output) | Wrong object targeted; React key collisions | Unique `id~n` keys in model and operations |
| Paragraph `rtl` ignored | Wrong bidi order in Arabic text | `dir` applied per paragraph |
| Arrowhead about 2.5× too large | Visual mismatch | Marker sized to 3× line width |
| Serif/monospace fonts fell back to sans-serif | Visual mismatch | Generic family fallback |
| Chart shown as a gray box | Poor usability | Labeled view-only preview from cached data |
| Missing lucide icon (`SquareRoundCorner`) | Build failure | Replaced with `RectangleHorizontal` |

Test-side mistakes (wrong expectations, locators matching thumbnails, pixel comparisons polluted by zoom) were also corrected and are not product defects.


---

## 23. Editor enhancements in this update

This update adds slide-level styling and a larger insertable shape library without changing the existing AI presentation-generation workflow or replacing the OOXML-preserving engine.

### Slide background
- Background tools live in the **Design** ribbon (desktop) and **Design** bottom sheet (phone).
- Set the active slide's background to a solid colour using theme colours, preset swatches, the native colour picker, or a six-digit hexadecimal colour.
- **Use theme background** removes the slide's explicit background and reveals the background inherited from its layout/master.
- Each change is one undoable transaction, is included in autosaved drafts, and is exported into the original `.pptx` package. The explicit **Apply current background to all slides** command copies the current solid colour to the whole deck as one undoable operation; ordinary colour-picker edits affect only the active slide.
- Background gradients and picture backgrounds remain preserved if unedited. Unsupported gradient/photo backgrounds disable Apply-to-all so a background isn't silently flattened or lost.

### Expanded shape gallery
- The desktop Insert ribbon provides a quick-insert row plus a **Shape gallery** command for the full searchable gallery.
- The mobile Insert sheet opens the same categorized searchable gallery, including basic geometry, additional arrows, symbols, callouts, and flowchart symbols.
- All offered presets remain native editable PowerPoint preset shapes in the exported file; their editor previews use dedicated SVG geometry.
- Shape outlines now expose all 11 standard PowerPoint preset dash patterns (solid, dash/dot variants, long patterns, and system patterns), with English and Arabic labels.
- Insertion bounds use more suitable square or vertical proportions for symmetric and vertical-arrow shapes.

### Verification added
- Engine regression coverage verifies single-slide and presentation-wide background set/reset, one-step undo/redo, XML/package validity, and export round-trip.
- A shape-gallery regression test inserts every offered preset and asserts that the editor renderer does not mark any of these presets as approximated.
- Outline dash regression coverage exercises all 11 available presets through model reads and exported PPTX validation.
- Run `npm run test:pptx`, `npm run build`, `npm run lint`, and the available browser suites before release. Automated browser touch emulation is not a substitute for physical Android and iOS device validation.

## 24. Contextual editor workflow and responsive workspace (October 18, 2026)

This revision is a workspace and interaction redesign over the existing OOXML-preserving engine. It does not claim complete Microsoft PowerPoint parity.

### Design references

- Microsoft Support, [Add shapes](https://support.microsoft.com/en-us/powerpoint/add-shapes)
- Microsoft Support, [Add a fill or effect to a shape or text box](https://support.microsoft.com/en-us/office/graphics-visuals/add-a-fill-or-effect-to-a-shape-or-text-box)
- Microsoft Support, [Use a screen reader to explore and navigate PowerPoint](https://support.microsoft.com/en-us/accessibility/powerpoint/use-a-screen-reader-to-explore-and-navigate-powerpoint)

### Contextual ribbon and background workflow

- Main ribbon tabs are `Home`, `Insert`, `Design`, `Text`, `Shapes`, `Image`, and `View`.
- The **Design** tab contains an **Apply current background to every slide** checkbox, six quick background presets, **Use theme background**, and **Reset all backgrounds to theme**. Checking the scope checkbox immediately copies the active slide's current solid colour to the complete deck in one undoable transaction and keeps subsequent background edits/presets scoped to every slide until unchecked. When unchecked, edits affect only the active slide. Gradient and picture backgrounds are not silently flattened by the scope control.
- The **Text** tab includes insertion, editing/deletion of text boxes, font family and size, bold, italic, underline, strikethrough, text colour, highlight colour, paragraph alignment and bullets. These formatting controls disable when no compatible text object is selected. Table objects route to the Text section but continue to use a dedicated table editor instead of object-level font controls. Formatting acts on whole objects, not character ranges.
- The **Shapes** tab includes the categorized/searchable shape gallery and shape-specific fill/no-fill, outline colour, outline width, 11 dash styles, opacity where supported, flips, duplicate and delete. Fill/line/opacity controls are disabled for incompatible selection kinds (for example, fill is disabled on a line). Shape selections auto-activate Shapes; text selections auto-activate Text; image selections auto-activate Image; mixed selections fall back to Home rather than applying incompatible formatting.

### Arrange and Layers utilities

- The desktop right utility sidebar contains only `Arrange` and `Layers`; Slide and Format panels were removed from the sidebar.
- **Arrange** provides four 1-point nudge arrows (up/down/left/right), precise X/Y/width/height fields, an interactive rotation wheel with keyboard control and angle presets, flip, align/distribute, group/ungroup, duplicate/delete and select-behind. These are general-purpose object operations.
- **Layers** shows one card per slide object in front-to-back order. Cards contain object identity/type and controls for show/hide, session lock/unlock and per-item reordering. Labelled commands for Bring to front, Bring forward, Send backward and Send to back are placed above the layer list. Desktop supports drag/drop; touch interfaces support a grip handle. Per-card up/down arrows have been removed for a cleaner layer card. Visibility is written to the PPTX DrawingML and hidden objects are excluded from the edit canvas and presentation preview. Lock state is editor-session only and is not exported.

### View, slideshow and mobile behavior

- Fit-to-screen remeasures the available canvas stage before resetting pan/zoom so it refits after layout changes.
- Presentation Preview displays slides using the same slide renderer as the editor, supports previous/next and keyboard `Left`/`Right`, `Home`, `End`, `Escape` navigation, and closes without mutating the source document.
- Phone bottom navigation includes Home / Insert / Design / Text / Shapes / Image / Arrange / Layers / Slides / View. Arrange and Layers use the same bounded scrollable sheet, capped at 72dvh, with an in-sheet tab switch. Ribbon sections also open as scrollable sheets rather than taking the entire screen. Selection of text, shapes and images automatically opens the matching mobile contextual section (except while the dedicated text-entry sheet is active).
- Web, Android WebView and iOS WKWebView share the same responsive React components and OOXML engine, but physical device/runtime verification is still required after dependencies are installed and Capacitor sync is run.

### Tests and scope limits

- Added PPTX regression tests for hidden-layer persistence/undo, explicit front-of-stack layer reorder semantics, strikethrough, and highlight persistence/removal. Existing background, outline and shape-gallery tests remain in the suite.
- Run `npm ci`, then `npm run test:pptx` and `npm run test:reliability`. Build/lint and real Android/iOS testing are still required in an environment with dependencies and device/simulator support; syntax checks alone are not equivalent to a production build.
- Existing limits remain: locks are not saved in PPTX; gradient/picture fills, chart-data editing, SmartArt authoring, animation/transition editing, arbitrary character-range text formatting and full PowerPoint fidelity are not implemented.


## 25. Opacity, layer reorder, and contextual action polish (October 18, 2026)

- Both Shape opacity and Image opacity use a custom wavy rail/track and a round touch-friendly thumb. The selected percentage is controlled by the document model. Shape/connector opacity writes alpha transforms on solid or gradient fill colours and outline colours; inherited theme style references are handled when local fill/line data is absent. Picture opacity is stored in `a:alphaModFix`, and any explicit picture border alpha is updated as well. Setting opacity back to 100% clears the previous alpha override.
- Text font and shape outline-style selectors use the same 38px field card, border, and 16px value text as numeric controls for visual consistency.
- The Design all-slide checkbox is a persistent scope: on-enable applies the current solid background to all slides; while checked, background picker changes and quick presets update all slides; unchecked, they update only the active slide. Quick preset options are Paper, Warm, Sky, Mint, Lavender, and Midnight. The separate Reset all backgrounds command remains explicit.
- Layer order actions show both icon and label. Clicking the row selects that layer, except when pressing an action button. Cards no longer contain separate move-up/down arrows; dragging the card or its touch grip reorders it. Engine reordering now maps directly through the panel's front-to-back order and disambiguated XML IDs. Each reorder remains a single undo step.
- The selected blue frame now provides Copy, Rotate 90°, and Delete quick actions. Keyboard shortcuts are Ctrl+C (copy to the editor clipboard), Delete/Backspace (delete), and Shift+R (rotate 90°); Ctrl+D remains available for duplication. Controls are hidden for locked or read-only selections.
- Added regression tests for shape/line/image opacity, restoring 100% opacity, valid export, and all front-to-back layer reorder target positions. Full runtime/device verification remains necessary after dependency installation.


## 26. Coordinated palettes, custom color picking, transforms and temporary visibility (October 18, 2026)

### Palette workflow (PPTX + SVG)
- The Design section's round multicolour button opens a gallery of 20 curated palettes, each with five swatches. Palette colour 1 is the slide/artboard background, with four accent colours assigned deterministically across objects. Separate text boxes cycle through different accents; shapes, outlines, connectors, picture borders and table cells also receive palette accents. Text contained in a filled shape or table cell receives a high-contrast light/dark ink. Palette application is one undoable PPTX transaction; in the SVG editor it is a document edit included in the SVG export. Raster image pixels are not recoloured.
- Palettes 1–10 pair light backgrounds with darker accents, while palettes 11–20 use dark backgrounds with light accents. The foreground contrast helper uses relative luminance to choose dark or white ink for text over a shape or table cell. The chosen palette is only a formatting operation; it does not flatten slides or convert shapes to images.

### Custom colours
- PPTX background, text, highlight, shape fill and outline fields provide theme/preset swatches plus a native `<input type="color">` picker and six-digit HEX field. SVG background solid colour, both gradient stops, selected-item fill and selected-item stroke use the same native picker + HEX editing pattern. HEX entries validate before committing.

### Flips and text bounds
- Horizontal/vertical flip controls are shown in the contextual Text, Shapes and Image sections when the selected object supports geometry transforms. Flip state is stored as DrawingML `a:xfrm` attributes (so it survives export) and the preview renderer mirrors the same geometry. SVG uses a measured selected-object bounding box in parent coordinates to flip text and vector shapes around their visual centre. Locked/read-only objects keep transform actions disabled.
- Resizing text boxes switches their DrawingML body-fit mode to `a:normAutofit`. The viewer preserves imported font sizes and DrawingML insets for ordinary text boxes and table cells. Browser-measured shrinking is only enabled when the source text body explicitly requests `normAutofit`; imported `fontScale` is still honoured. This avoids headings and normal text shrinking as a side effect of opening or navigating to a slide. For explicitly auto-fitting objects, measurements are scheduled against the fixed text frame, not the changing text content.

### Temporary visibility helper
- View includes a temporary Hide/Show selected in editor action for both the PPTX and SVG editor. PPTX temporary-hidden items are filtered from the edit canvas and presentation preview without changing slide XML or export data. SVG temporary-hidden items use editor-only CSS outside the SVG document markup and are not serialised into the exported SVG. Temporary visibility resets on slide change/reopen; use the normal Layers visibility operation if the item should be hidden in the actual presentation file.

### Verification notes
- Palette application uses five validated six-digit HEX colours and remains undoable. The engine regression suite covers palette application, per-item text accent assignment, fill recolouring, round-trip PPTX export, and flip flags for text, shapes and pictures. Static JSX syntax and translation-key checks should also be run after UI changes. A successful syntax parse alone does not establish a full production build; run `npm ci`, `npm run test:pptx`, `npm run test:reliability`, `npm run build` and `npm run lint` in a configured environment before release, and verify browser/Android/iOS runtime behavior.

### Palette module deployment note
The palette UI depends on all three shared files: `src/components/shared/ColorPalettePicker.jsx`, `src/components/shared/colorPalettePicker.css`, and `src/components/shared/presentationPalettes.js`. When updating an existing checkout by copying individual files, add these new files as well as replacing the modified editor files. Missing shared modules can prevent the lazy-loaded PowerPoint editor from opening. The editor-loading fallback now exposes the caught error message and retries with a fresh lazy component instance.
### React update-depth safeguard (2026-10-18)

- Automatic preview shrinking is now restricted to text bodies whose source DrawingML explicitly requests `normAutofit`; normal text boxes and table cells retain their imported run sizes and insets. For those explicitly auto-fitting objects, measurements are scheduled through `requestAnimationFrame`, watch only the fixed text frame, and do not observe the scale-changing content. This prevents general text from shrinking simply when a slide is opened and avoids the previous text-pulsing feedback loop.
- Canvas and visual-viewport measurements now ignore unchanged dimensions, avoiding redundant state updates.

