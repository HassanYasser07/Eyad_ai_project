# FREE DESIGN STUDIO — FULL IMPLEMENTATION PLAN
**Project:** EYAD AI (React 18 + Vite + Tailwind + Supabase + Capacitor)  
**Deliverable:** a new studio, **"Free Design Studio" / "ستوديو التصميم الحر"**, with its own full-screen editor ("Free Design Environment"), template + background libraries, Pen tool, rulers/guides, shape tools, Pathfinder, SVG/image import and PDF/PNG/SVG export.  
**Audience of this document:** the Claude instance that will implement it. It receives only `src/`. Everything it needs to know about the existing code is summarised in §1 and §6 with file references; anything it cannot see is listed in §15 and, where unavoidable, drafted here (e.g. SQL).  
**Status:** planning only. No implementation was started.

---

## EXECUTIVE SUMMARY (read this first)

**What we are building.** A new studio — **Free Design Studio** (`/studios/free-design`, AR *ستوديو التصميم الحر*) — whose heart is a full-screen **Free Design Environment**: a Canva-/Illustrator-grade vector editor for *any* print or social design at *any* size (px / mm / cm / in), with **PDF export**, an **editable template library**, **ready backgrounds**, a real **Pen tool**, **rulers + guides**, geometric **shape tools**, **Pathfinder** (the exact Illustrator panel from the client's screenshot), and **image + SVG import**. It is opened from a **"Test Free Design Environment"** pill (identical in placement and style to the existing *Test Presentation Environment* / *Test SVG Environment* buttons) whose Start screen lets you **upload an image/SVG and test immediately**.

**What the client asked for (R1–R11, §2.1)** → all covered: free-size design · PDF download · editable templates · backgrounds + template categories (social, brochures, business cards, newborn/birthday themes) · start from scratch with tools/shapes · image & SVG import · Pen · ruler · shapes (square, triangle, …) · Pathfinder.

**What we add beyond the brief (the "best UX" part, §4.7):** brand-aware design (one tap applies the project's logo, colours, fonts) · one-tap re-theme with 20 curated palettes · Arabic⇄English copy flip with mirrored layouts · smart photo placeholders & photo-in-shape frames (arch, circle, heart…) · Magic Resize (Post → Story → A5) · business-card mode (front/back, bleed, safe zone) · print-readiness hints (low-dpi image, text near trim) · smart guides with distance labels · pencil tool + touch-first pen (magnifier loupe) · autosave/resume · keyboard- and touch-complete · full accessibility + RTL.

**How it matches the existing editors exactly (§6).** Same `editorKit` components (wave sliders, half-circle rotation wheel, colour cards, segmented controls, panel shell, layer cards, mobile tab bar, bottom sheets, toasts), same tokens/fonts/motion (hover lift, press `scale(.97)`, sheet spring, card stagger), same responsive switch (ribbon + side panels on desktop → bottom tab bar + animated bottom sheets on phones), same lazy-loaded portal host with error boundary. No existing editor file is modified.

**Architecture in one paragraph (§7).** Pure-JS engine (document model → immutable ops → one *VNode* scene renderer used by both screen and export, so they can never diverge), tool plugins on a pointer-capture canvas ported from the PPTX canvas, paper.js (lazy) for Pathfinder, browser-native text shaping for flawless Arabic, banded rasterisation → jsPDF for 300-dpi multi-page PDF on phones without crashing, IndexedDB drafts, Supabase only for optional saving (new `free_design_versions` table + buckets). Content (60 templates, 72 backgrounds) is code-generated vector art, bundled offline.

**Delivery (§11).** 8 phases, ≈ 16 implementer sessions; **Phase 1 (≈1.5 sessions) already delivers the client demo**: studio visible everywhere + Test button + upload image/SVG + pan/zoom + PDF/PNG export in the final responsive shell.

**Things that need you (§14, §15).** (1) Listen to the **voice note** — I could not transcribe it here. (2) Confirm the 12 open questions (defaults are pre-filled). (3) Pass the extra files of §15 with `src/` (**package.json, CLAUDE.md, AGENTS.md, docs/PPTX_EDITOR*.md, the 3 Supabase migrations**, configs, a few test files, screenshots). (4) Run `npm i paper` and the SQL migration when the phases reach them.

**Two verified hazards in the current code (§1.5, §9):** the intro 3-D carousel hard-codes 7 studios (an 8th breaks it) and `Studios.jsx` renders the *templates* card twice.

---

## TABLE OF CONTENTS
0 Rules for the implementer · 1 Ground truth about the project · 2 The client request decoded · 3 Product definition · 4 Feature specification · 5 UX specification · 6 UI compliance checklist · 7 Technical architecture · 8 Content, data & backend · 9 Integration changes · 10 i18n · 11 Delivery phases · 12 Tests · 13 Risks · 14 Open questions · 15 Extra files needed · 16 Definition of done · Appendix A


---

## 0. READ THIS FIRST (rules for the implementer)

1. **Match the existing editors exactly.** The Free Design editor must be visually and behaviourally indistinguishable in *style* from the PPTX editor (`src/components/pptxEditor/`) and the SVG editor (`src/components/svgEditor/`): same shared kit (`src/components/editorKit/`), same tokens, same wave sliders, same half-wheel rotation control, same bottom tab bar + bottom sheets on phones, same panels on desktop, same toasts/modals, same motion. §6 is the compliance checklist. If you are about to write a new control, first check `editorKit/index.js` — it almost certainly exists.
2. **Do not modify the PPTX or SVG editors.** Do not edit any file under `components/pptxEditor/` or `components/svgEditor/`, and do not change existing `ek-*` rules in `editorKit.css` (the PPTX editor depends on them). You may *import* from `editorKit` and *append* new, clearly-marked `ek-*` additions to the end of `editorKit.css` **only** when a control is genuinely missing (see §6.4). Everything else Free-Studio-specific lives in its own folder with its own CSS prefix `fd-`.
3. **Lazy-load the editor** exactly like `PresentationsStudio.jsx` does (`React.lazy(() => import(...))` + error boundary + Suspense fallback + retry). The engine's heavy dependencies (paper.js, jsPDF, JSZip) must be dynamic imports.
4. **Everything user-visible is bilingual (AR + EN) and RTL-safe.** Add keys to `src/i18n/translations.js` for both languages. Use logical CSS properties (`inline-start/end`, `ps-/pe-`, `margin-inline-*`), never `left/right` for layout. The canvas itself is always `dir="ltr"` (like `.pe-thumb { direction: ltr }`), the chrome follows the app direction.
5. **Guest-first.** Opening the editor, designing and exporting must work without an account (the app is guest-first). Only *saving to My Projects* requires a registered account (use the same `requireAccount` / login-dialog pattern as the PPTX editor).
6. **Ship in the phases of §11.** Each phase ends in a working, testable editor. Do not start Phase N+1 before Phase N's definition-of-done is met.
7. **Add tests** (§12) as you go; this repo has `node:test` suites in `tests/reliability/` and Python-Playwright e2e in `tests/e2e/`.
8. **You only receive `src/`.** Things outside `src/` (package.json, Supabase SQL, the chat-router edge function, `public/` assets) are listed in §9/§15 — do the `src/` part, and give the user a precise checklist for the rest. If `package.json`, `CLAUDE.md`, `AGENTS.md` and `docs/PPTX_EDITOR*.md` were passed with `src/`, **read them first; they win over this plan on conflicts.**
9. **Never invent project facts.** Where this plan says "read X first" or "verify at implementation time", do it and report the result.

---

## 1. WHAT WAS REVIEWED (ground truth about the project)

### 1.1 Product
EYAD AI is an Arabic/English, RTL/LTR, guest-first creative suite. Registry (`src/studios/studioRegistry.js`) currently has 7 sections: Logo, Visual Identity (`brand-kit`), AI Images (`ai-images`), Video, Presentations, Templates (AI templates + ready templates), Marketplace. Each studio is a route under `/studios/<id>` declared in `src/App.jsx` inside `<AppLayout/>`; the chat router (`core/eyadCore.js`) can hand a user to a studio; `StudioNextActions` + `services/projectContextService.js` move assets between studios; the **Brand Source of Truth** (`services/brandService.js` → `project_data.brand_identity`: logo, 4-color palette, Arabic/English typography, background) is shared by all studios.

### 1.2 The two reference editors (the style we must clone)
| | SVG editor | PPTX editor |
|---|---|---|
| Entry | `LogoStudio.jsx` pill button **"Test SVG Environment"** (`t("svgEditor.testEnvironment")`) → `<SvgEditorDialog/>` | `PresentationsStudio.jsx` pill button **"Test Presentation Environment"** (`data-testid="open-pptx-editor"`, `PencilRuler` icon) → lazy `<PptxEditorDialog/>` |
| Shell | `createPortal(..., document.body)`, `.svg-editor-overlay` (blur backdrop, `sve-overlay-in`) → `.svg-editor-dialog` (100vw×100dvh, `sve-dialog-in`) | `.pe-root` fixed inset 0, z-index 10000 |
| Desktop chrome | header (brand icon + title + file name, Open / Use-in-identity / **Export** / Close) → toolbar (Undo/Redo/Reset · palette/text/icons/background/duplicate/group/delete) → **context bar** (colors / style / text groups with art titles) → 3-column workspace (Layers · Canvas · Properties, both side panels collapsible to a 46px rail) → footer | top bar → **PowerPoint-style ribbon** (tabs Home · Insert · Design · Text · Shapes · Image · Table · View — Shapes/Image/Table are always listed and their controls enable by selection; groups with art tiles) → body (Slides strip · Canvas · Properties/Layers `PanelShell`) → footer |
| Mobile (≤660 / `compact` ≤767) | bottom `ek-mobile-tabbar` (Layers · Arrange · Size · Colors · Text · Typography · Icons · Background), animated bottom sheets, full-screen mobile text composer, layers drawer | bottom `MobileTabBar` (Layers · Slides · View · Arrange · Size · Insert · Design · Text · Shapes · Image · Table), `BottomSheet` with grab handle + spring up / 0.2 s down, `MobileTextScreen`, floating slide nav, swipe between slides |
| Start state | upload card with drag-and-drop + "Open" | `Start` screen: big drop button, draft-resume card, "what is supported / limits" card |
| Persistence | export `.svg`; optional send to Visual Identity | IndexedDB draft (`fileIO.js`), `beforeunload`/`pagehide` flush, history guard (`popstate`), save-to-project dialog (new version / replace), login dialog |

### 1.3 Shared kit (`src/components/editorKit/`) — reuse, don't rewrite
`RangeControl` (wave slider; layouts default / compact / editable), `NumberField`, `Stepper`, `RotationHalfWheel` (−180…180 dial, ticks, presets), `ColorPickerCard`, `ColorSwatches`, `ColorPopoverField`, `NudgePad`, `ActionGrid`+`QuickAction`, `PresetPills`, `Segmented`+`Divider`, `SwitchRow`, `SelectField`, `PropertySection`+`SubCard`+`EmptyCard`, `PanelShell` (heading, count, collapse chevron, rail title, tab row), `LayerCard`, `MobileTabBar`, `EditorSheet`, `Toast`, `KitIconButton`, duotone icon set (`icons.jsx`: Layers, Arrange, Size, Colors, Text, Typography, Background, Solid, Gradient, Image, Reset, Back, Pen, Upload, Home, Insert, Design, TextBox, Shapes, Table, Slides, View, Present, Properties, align glyphs), `utils.js` (`COLOR_PRESETS`, `normalizeAngle`, `normalizeColor`, `formatNumber`…). Tokens live in `editorKit.css` (`--ek-radius-sm/md/lg/xl`, `--ek-shadow-sm…xl`, `--ek-transition-fast/normal/smooth`, `--ek-surface-1/2/3`) on top of the app tokens in `src/index.css` (`--background --foreground --card --primary(#2563eb) --secondary --muted --accent --border --ring`, fonts Plus Jakarta Sans / Cairo, radii 12/16/24).

### 1.4 Other reusable assets already in `src/`
* **Fonts:** `svgEditorControls.jsx` → `FONT_GROUPS` (system, sans, serif, display, script, mono, **arabic**: Cairo, Tajawal, Amiri, Almarai, Alexandria, Reem Kufi, Mada, Baloo Bhaijaan 2…) + `ensureEditorFonts()`; `pptxEditor/fonts.js` shows how to wrap them (`PPTX_FONT_GROUPS`, `fontSelectOptions`). **Reuse the same groups** so every editor offers identical fonts.
* **Icon library** (Supabase `studio_icons` + bucket `eyad-icons`): `services/iconLibraryService.js`, `hooks/useIconLibrary.js`, `components/shared/IconLibraryPicker.jsx`, `fetchIconSvgText` → used by both editors; will feed our **Elements → Icons** tab.
* **Palettes:** `components/shared/presentationPalettes.js` (20 curated 5-colour palettes, colour 1 = background) + `ColorPalettePicker.jsx`; Visual-Identity presets in `studios/brandKit/presets.js` (`COLOR_PALETTES`, `ARABIC_FONTS`, `ENGLISH_FONTS`, `BACKGROUNDS`).
* **Geometry:** `pptxEditor/engine/geometry.js` (`rotatedBox`, `unionBox`, `hitTest`, `snapBox`, `computeAlign`…, pure functions) and `pptxEditor/engine/shapes.js` (`presetGeometry(prst,w,h,adj)` → SVG path strings for ~100 preset shapes: arrows, stars, callouts, flow-chart…). **Copy** (do not import across editors) into `freeDesign/engine/` and adapt units from EMU to px.
* **Canvas interaction reference:** `pptxEditor/Canvas.jsx` — pointer-capture gesture machine (press / handle / pan / pinch / marquee), rAF-coalesced live drafts (`pushDraft`), alignment guides gated by pointer speed (`SNAP_MAX_SPEED`), wheel-zoom + iOS gesture blocking, double-tap zoom, floating quick buttons (`Copy / Rotate / Delete`), 44 px touch handle hit-areas (`.pptx-handle`). **Re-implement the same machine** for the Free canvas.
* **Persistence/IO:** `pptxEditor/fileIO.js` (`saveBytes` with Capacitor share-sheet on native, Web Share on touch, `<a download>` fallback; `pickFile`; `IMAGE_ACCEPT`; IndexedDB draft store; `isNative()`); `services/exportService.js` (jsPDF + PptxGenJS usage); `components/brandKit/brandProfilePdf.js` (**canvas → JPEG → jsPDF with `hotfixes:["px_scaling"]`** — the in-repo pattern for pixel-exact PDFs); `services/assetService.js` (`listUserImages`, `uploadImageAsset`); `services/projectService.js`; `services/brandService.js`.
* **Security reference:** `svgEditor/svgDocument.js` sanitises uploaded SVG (drops `script/foreignObject/iframe/…`, unsafe CSS values, external refs) — reuse its rules for our SVG importer.
* **Libraries already installed (seen in `src` imports):** `react`, `react-router-dom`, `@tanstack/react-query`, `lucide-react`, `@radix-ui/*` (slider, popover, switch, tabs, dropdown…), `framer-motion`, `jspdf`, `jszip`, `pptxgenjs`, `@capacitor/{core,filesystem,share,browser,app}`, `@supabase/supabase-js`, `vaul`, `cmdk`, `sonner`, `moment`, `recharts`.
  **New dependency required:** `paper` (paper.js, MIT, the `paper-core` build) for Pathfinder boolean operations (§7.6). Nothing else is required; do **not** add Fabric/Konva/Excalidraw — we need exact visual parity with the existing editors and full control over the scene model.

### 1.5 Registration points that a new studio touches (verified)
`studios/studioRegistry.js` (entry + aliases) · `studios/studioIcons.js` · `App.jsx` (route) · `components/home/HomeStudios.jsx` (`HOME_STUDIO_IDS`, `STUDIO_VISUALS`) · `pages/Studios.jsx` · `pages/StudiosDesktop.jsx` (`PASTEL` map) · `components/home/DesktopHomeContent.jsx` (`PASTEL`) · `pages/Search.jsx` (`studioIconMap`, `studioAccent`) · `components/studios/StudioNextActions.jsx` (`ICONS`) · `services/projectContextService.js` (`STUDIO_NEXT_ACTIONS`) · `core/eyadCore.js` (`ROUTES` regexes) · `core/toolRegistry.js` (only if AI is added — not in scope) · `components/ProjectRow.jsx` (project thumbnails) · `services/generationTracker.js` (route map, only for generation kinds) · i18n.
**⚠ Verified hazards:**
* `components/intro/IntroTile.jsx` hard-codes `const CARD_COUNT = 7` **and** 7-element `Y_OFFSETS` / `ARC_OFFSETS` arrays, while `pages/Intro.jsx` uses `studioRegistry.length` for the 3-D carousel. Adding an 8th registry entry **breaks the intro geometry** (the 8th card gets the wrong angle and no arc offset). See §9 item 4 for the required fix.
* `pages/Studios.jsx` builds `[...HOME_STUDIO_IDS, "templates"]` although `HOME_STUDIO_IDS` already contains `"templates"` (duplicate card). Dedupe while you are there (one-line `Array.from(new Set(...))`).
* The existing **Templates Studio** (`pages/TemplatesStudio.jsx`) is *AI-generated / ready-image templates*, not an editor. Free Design Studio is the **manual editor + editable template library**. They must be cross-linked, not merged (§9 items 13 and 16).

---

## 2. THE CLIENT REQUEST — DECODED

### 2.1 Client message (Arabic) → requirements
> "عايزين نعمل استوديو جديد يكون للتصميم الحر — تصميم بروشور أو فلايرات أو سوشيال ميديا يعني أي تصميم بأي مقاس يحدده المستخدم ويحمل التصميم PDF بعد ما يخلص — وهنحط كمان جواه قوالب للتعديل عليها — هنحط كمان خلفيات وقوالب جاهزة هنعمل أقسام زي سوشيال ميديا وبروشورات وبزنس كارد وثيمات مواليد كدا يعني — هتكون القوالب قابلة للتعديل وممكن يحدد قياس معين ويبدأ يصمم فيه من الصفر باستخدام أدوات الإيديتور والأشكال وفيها استيراد صور و SVG — وحط كمان pen tool والمسطرة اللي بتكون في الإيديتورز وكدا — وأدوات الأشكال مربع ومثلث وباقي الأشكال الهندسية و Pathfinder"

| # | Client requirement | Where it lands |
|---|---|---|
| R1 | New studio for **free design** (brochure, flyer, social media… any design) | `free-design` studio, §3 |
| R2 | **Any size the user defines** | Custom-size dialog + presets + unit system (px/mm/cm/in), §4.2 F1 |
| R3 | **Download as PDF** when finished | Export pipeline, multi-page PDF at exact size, §7.9 |
| R4 | **Editable templates** inside | Template library + template → editable scene, §4.3 F3 |
| R5 | **Ready backgrounds + templates**, **categories**: social media, brochures, business cards, **"ثيمات مواليد"** (newborn / birth-celebration themes), "etc." | Library categories §4.3, content plan §8.4 |
| R6 | Start **from scratch in a chosen size** with editor tools & shapes | Blank-canvas flow, tools §4.4 |
| R7 | **Import images and SVG** | Media panel, SVG importer, §4.6 / §7.8 |
| R8 | **Pen tool** | §4.5 F5 / §7.3 |
| R9 | **Ruler** "like in editors" | Rulers + guides §4.5 F6 / §7.5 |
| R10 | **Shape tools**: square, triangle, other geometric shapes | Shape tools §4.4 F4 |
| R11 | **Pathfinder** | §4.5 F7 / §7.6 |

### 2.2 The three images (Illustrator references)
1. **Pathfinder panel** — *Shape Modes:* **Unite, Minus Front, Intersect, Exclude** + **Expand** button; *Pathfinders:* **Divide, Trim, Merge, Crop, Outline, Minus Back**. → We replicate this panel **1:1 in order, labels and icon logic** (live "Shape Modes" that can be Expanded + destructive "Pathfinders"). §4.5 F7.
2. **View menu with a green hand-drawn outline around the left toolbar and the top/left rulers** → the reference wants: a **vertical tool rail on the left** and **horizontal + vertical rulers** on the canvas edges; the menu lists the behaviours expected from *View*: Outline, Pixel Preview, Presentation Mode, Zoom In/Out, Fit Artboard in Window, Actual Size, Hide Edges, Hide Artboards, Show Grid/Transparency Grid, **Smart Guides**, Perspective Grid, **Rulers**, **Guides**, Show Print Tiling. → Our *View* tab/sheet: Rulers, Guides (show/lock/clear), Smart Guides, Grid, Snap options, Outline mode, Pixel preview, Presentation mode (reuse PPTX preview pattern), Fit page, Actual size, Zoom, Hide page boundary. (Perspective grid / print tiling / slices are **out of scope**.)
3. **Shape tool flyout**: Rectangle `(M)`, Ellipse `(L)`, Polygon, Star, Line Segment `(\)` with the tool icon showing a small corner triangle (flyout indicator) → our tool rail uses the **same flyout pattern** (corner triangle, long-press on touch / click-and-hold or right-click on desktop, keyboard shortcut shown on the right).

### 2.3 Voice note
`WhatsApp_Audio_2026-11-18_at_8.24.14_AM.ogg` (62 s, Arabic) **could not be transcribed in the analysis environment** (no speech model reachable from the sandbox). This plan is therefore based on the written client message + the 3 images. **Before implementation starts, someone must listen to the voice note and confirm §14 (open questions) and that nothing in it contradicts this plan.** The plan was written so that any additional request from the voice note can be slotted in without changing the architecture (all features sit behind the node/tool/panel registries of §7).

### 2.4 Interpretation of ambiguous items (decisions taken; confirm with client)
* **"ثيمات مواليد"** → we read it as *newborn / baby-arrival & birthday themes*: **Newborn announcements, Baby shower, Gender reveal, 1st birthday, Birthday invitations, Milestone cards, Aqiqah invitation**. If the client meant *birthdays only* or *zodiac*, only the content packs change.
* **"بأي مقاس"** → any width × height up to **10 000 × 10 000 px** (≈ 2.6 m @ 96 dpi); units px / mm / cm / in; presets + custom; orientation swap; *Resize design* later (Magic Resize, §4.7).
* **"يحمل PDF"** → **PDF is the primary export** (multi-page, page size == design size exactly, selectable print quality). PNG/JPG/SVG/project-file exports are bonuses.
* **"المسطرة"** → rulers on top and left of the canvas **with draggable guides** (Illustrator/Photoshop behaviour), unit-aware, not a measuring tool.
* **"Pen tool"** → full Bézier pen (click = corner, drag = smooth, close, continue, add/delete anchors, node editing) — not a freehand brush. A freehand **Pencil** is added as a bonus (very useful on touch).

---

## 3. PRODUCT DEFINITION

| Item | Value |
|---|---|
| Studio id | `free-design` |
| Route | `/studios/free-design` (+ `?project=<id>` and `?asset=<id>` handoff params, same contract as other studios) |
| Name | EN **Free Design Studio** · AR **ستوديو التصميم الحر** |
| Tagline | EN *"Design anything, any size — then download it as PDF."* · AR *"صمّم أي شيء بأي مقاس… ثم نزّله PDF."* |
| Icon | `PenTool` (lucide) added to `studioIcons.js` |
| Accent | `#e11d48` (rose-600; distinct from the existing accents) · pastel tile `#FFE4E6` |
| Status | `active` |
| Editor name (button + title) | EN **"Test Free Design Environment"** · AR **"بيئة اختبار التصميم الحر"** (same naming pattern as "Test Presentation Environment" / "Test SVG Environment") |
| Editor test id prefix | `fd-` (e.g. `data-testid="open-free-editor"`) |
| CSS prefix | `fd-` (page + editor); shared kit stays `ek-` |

**Positioning inside EYAD:** Logo Studio *makes the mark* → Visual Identity *makes the system* → **Free Design Studio *uses the system to make anything printable/postable*** (cards, flyers, posts, brochures) → Presentations for decks. It is the only studio where the user has full manual control. Its unique EYAD-native advantage is **Brand-aware design** (§4.7).

### 3.1 Primary user journeys
1. **"I need an Instagram post for tomorrow."** Studio → pick *Social Media* → tap a template → it opens already in the editor at 1080×1080 → edit text (Arabic or English) → *Apply my brand* → Export PNG.
2. **"I need a brochure for the printing press."** Studio → *Custom size* (e.g. 297×210 mm, 3 pages, 3 mm bleed) → start blank or from a *Brochure* template → pages strip → Export **PDF (300 dpi, with bleed)**.
3. **"I have my own artwork."** Studio → **Test Free Design Environment** button → upload an image/SVG → editor opens with a page sized to the image → draw with Pen, add shapes, Pathfinder, export.
4. **"From the AI Images studio."** Handoff `?project=…&asset=…` → editor opens with the generated image as a full-bleed picture ready to overlay text.
5. **"Baby announcement."** Studio → *Newborn & Baby* → pick theme → replace photo placeholder by tapping the dashed frame → change names → PDF/PNG.

### 3.2 Personas
Small-business owner on a phone (primary — mobile layout must be first-class), freelance designer on desktop (needs precision: pen, rulers, pathfinder, numeric fields), a parent making an announcement (templates + placeholders), the client demoing the product (the "Test" button).

---

## 4. FEATURE SPECIFICATION

Priority: **P0** = must ship in v1 (client asked or editor unusable without), **P1** = ship in v1 if time, **P2** = designed-for, later.

### 4.1 Studio landing page (`pages/FreeDesignStudio.jsx`, route `/studios/free-design`)
Mirrors `PresentationsStudio.jsx` structure: `<DesktopShell>` wrapper, gradient hero background, `max-w-6xl` container, header row with **Back** pill (left) and on the right **[Test Free Design Environment]** pill (`PencilRuler` icon, `border-primary/25 bg-card text-primary`, identical classes to `open-pptx-editor`) + studio badge pill (`from-primary to-violet-600` gradient pill with the studio icon).

Sections, top to bottom (all P0 unless noted):
1. **Hero composer card** "What do you want to design?" — row of **format chips** (Instagram Post, Story, Flyer A5, Brochure, Business Card, Poster, YouTube Thumbnail, **Custom**) → tapping a chip opens the editor *blank at that size*; **Custom size** opens `SizeDialog` (§5.5).
2. **Resume card** (P0) — if an IndexedDB draft exists: "Continue your last design" with thumbnail, name, time, *Resume* / *Discard* (same visual as `pe-draft`).
3. **Templates gallery** (P0) — category tabs (`role="tablist"`, same markup as `TemplateGallery.jsx`): *All · Social Media · Brochures · Flyers · Business Cards · Newborn & Baby · Birthdays · Invitations · Posters · Menus · Certificates · Seasonal (Ramadan/Eid/National Day) …*. Cards (`aspect` follows the template's real ratio, not fixed 16/9), page-count badge (like the slide-count badge), size caption ("1080 × 1080 px"), hover lift, selected ring, loading overlay while the template JSON downloads. Tap → opens editor with that template.
4. **Backgrounds gallery** (P0) — horizontal chip categories (Gradients, Abstract, Geometric, Patterns, Floral, Festive, Pastel/Baby, Dark/Neon, Islamic/Arabesque, Paper…) → tap opens the editor on a blank page of a chosen preset with that background applied (also reachable inside the editor).
5. **My designs** (P1) — the user's saved Free Design projects (thumbnail + name + date), via `projectService.list` filtered on `studio_type === "free-design"`.
6. `StudioNextActions` (existing component) after export/save when `?project` is present.

Empty/error/loading states for every gallery (skeleton cards, retry button identical to `TemplateGallery`'s error state).

### 4.2 Document & canvas (F1–F2)
**F1 · New design / size (P0)**
* **Size presets** grouped: *Social* (IG Post 1080², IG Portrait 1080×1350, Story/Reel/TikTok/WhatsApp-status 1080×1920, FB Post 1200×630, FB Cover 820×312, X Post 1600×900, X Header 1500×500, LinkedIn Post 1200×627, LinkedIn Banner 1584×396, YouTube Thumbnail 1280×720, YouTube Banner 2560×1440, Pinterest Pin 1000×1500) · *Print* (A3, A4, A5, A6, DL, Letter, Legal, Business Card 90×50 mm, US Card 3.5×2 in, Postcard A6, Invitation 5×7 in, Poster 50×70 cm / 18×24 in, Tri-fold A4-landscape, Bi-fold A4-landscape, Menu A4/DL, Letterhead A4, Certificate A4-landscape) · *Screen* (HD 1920×1080, 4K 3840×2160) · **Custom**.
* **Custom size dialog:** width, height, unit (px/mm/cm/in), orientation toggle (swap), lock ratio, DPI note, **pages** (1–20), **bleed** (0 / 3 mm / custom), live preview rectangle with real proportions, min 1 px / max 10 000 px per side (clamped with an inline hint, never an error wall).
* Internal unit is **CSS px @ 96 dpi** (`px = mm × 96 / 25.4`). Document stores its *display unit* so rulers/inputs speak the user's unit.
* **Resize design / Magic Resize (P1):** change page size later with content scaled/re-anchored (anchor rules per node: scale, pin-to-edge, keep-size-center). Duplicate-as-new-size variant ("Make Story version").

**F2 · Canvas & navigation (P0)**
* One active page on canvas, **page strip** below (multi-page: add, duplicate, delete, reorder by drag, rename). Compact layout: Pages sheet + swipe between pages (same `useSwipeNav` behaviour as PPTX, disabled while a draw tool is active or an object is selected).
* Pan (Space-drag, middle mouse, Hand tool, two-finger), zoom (wheel+Ctrl/Cmd, pinch, `+/-`, zoom field with wave slider, **Fit**, **100 %**, double-tap/-click zoom toggle like PPTX), zoom range 5 %–1600 %.
* Page drawn with shadow on a neutral pasteboard; objects may extend beyond the page (clipped on export); **bleed area** shown as a tinted band; **margin/safe area** overlay (toggle; "Story safe zone" overlay preset P1).
* Background: solid, linear/radial gradient (multi-stop), image fill, or a **library background** (applies to the page, replaceable, never mixed into layers unless the user ungroups it).
* **Autosave draft** to IndexedDB (debounced + on `visibilitychange/pagehide`), history guard on browser Back (reuse the PPTX `peEditorGuard` approach with key `fdEditorGuard`).

### 4.3 Libraries (F3)
**F3 · Templates (P0)**
* Template = a complete editable document (1–N pages) + metadata. Opening a template **copies** it into a new document (templates are never mutated).
* **Placeholders** (P0): *image frames* (dashed frame with "+" in editor, invisible/neutral in export) and *named text fields*. Tapping an empty frame opens Media picker; dropping/picking an image fills it (cover-fit, then crop mode).
* **Colour roles & font roles** (P0): template colours/fonts reference roles (`bg, ink, primary, accent1, accent2`; `heading`, `body`) so that **one tap re-themes** a whole design with any of the 20 existing palettes or the project's brand palette (mirrors the PPTX "Colour palette" feature) and swaps Arabic/English font pairs.
* **Bilingual templates** (P0): every text node carries `{ar, en}` copy + direction; a *Language* toggle (AR/EN) flips copy and mirrors the layout where the template declares `mirror: true`. Most templates ship in both.
* Categories and counts: see §8.4 (v1 target **60 templates**, minimum viable **24**).
* Search by name/tag (P1), recent (P1), favourites (P2).

**F3b · Backgrounds (P0)** — ≥ 72 vector backgrounds (v1 target; min 36) in the categories of §4.1; each is a tiny JSON (shapes/gradients/patterns) → crisp at any size and print; **auto-fit to any page size** (backgrounds are defined in a unit square and scaled with `preserveAspectRatio` rules: *stretch, cover, tile*). Apply = set page background; "Add as layer" = insert as a locked group.

**F3c · Elements (P0)** — shape library (§4.4), line styles/arrows, **icons** (existing icon library), **frames** (image frames in circle/rounded/arch/heart/blob shapes — the "Boho arch" and "circle photo" are very common in baby/birthday designs), decorative **dividers/flourishes**, **stickers** (vector doodle packs P1), QR code generator (P2).

**F3d · Media (P0)** — *Uploads* (device picker, drag-drop, paste from clipboard), *My AI images* (`assetService.listUserImages`), *Brand* (logo from `getBrandIdentity`). SVG and raster supported (§7.8).

### 4.4 Tools & shapes (F4)
**Tool rail (desktop, start edge; floating on compact)** — same visual family as `ek-icon-btn` / `ek-seg-btn`; active tool uses `.is-active`; flyout indicator triangle; shortcut letters in tooltips and flyout rows (as in the Illustrator reference image 3).

| Tool | Shortcut | Notes |
|---|---|---|
| **Select** | V | move, resize, rotate, marquee, shift-add, group-aware; double-click enters group / text / path edit |
| **Direct select (node edit)** | A | anchors + handles of paths |
| **Pen** | P | §4.5 F5 |
| **Pencil (freehand)** | N | smoothing slider (wave slider) |
| **Shapes flyout** | M / L | **Rectangle (M)**, **Ellipse (L)**, **Triangle**, **Polygon**, **Star**, **Line Segment (\\)**, **Arrow**, **Heart**, **Cross**, **Ring**, **Arch**, **Blob**, **Burst**, **Speech bubble**, plus "All shapes…" sheet (searchable, categorised exactly like `pe-shape-categories` using the copied `presetGeometry` library) |
| **Text** | T | click = point text, drag = area text; Arabic-first |
| **Image** | I | file picker → places at centre, or drag-drop onto canvas / onto a frame |
| **Hand** | H / Space | pan |
| **Zoom** | Z | click zoom-in, Alt-click zoom-out, drag-rectangle |
| **Eyedropper** | E | P1 — pick colour from canvas into fill/stroke |

**Shape behaviour (P0):**
* Draw by drag; **Shift** = constrain (square/circle/45°), **Alt** = from centre; click without drag opens a tiny "Create shape" numeric popover (W×H) — the Illustrator behaviour.
* **Parametric & live** until converted: rectangle (per-corner radius with a canvas corner-handle **and** a wave slider), polygon (sides 3–20), star (points 3–20, inner-radius ratio), triangle (apex position), arrow (shaft/head), heart/cross/ring/arch parameters. Parameters appear in the *Properties → Shape* section as `RangeControl`s. Editing nodes (double-click) asks once "Convert to editable path?" (or auto-converts with an undo toast).
* Fill, stroke (width, **dash presets**, cap, join, arrowheads for lines), opacity, **shadow**, **blur** (P1), **corner radius**, **gradient** (linear/radial, multi-stop, angle via `RotationHalfWheel`), **image fill** (P1).

### 4.5 Pro tools (F5–F7)
**F5 · Pen tool (P0)** — full spec §7.3. Highlights: click = corner anchor; click-drag = smooth anchor with symmetric handles; close by clicking first anchor; Enter/Esc finishes open path; Backspace removes last anchor; **Alt** = break handle; **Shift** = 45° constraint; hover a segment = add-anchor cursor, hover an anchor = delete-anchor cursor; live rubber-band preview of the next segment; snaps to guides/grid/objects. **Touch:** tap = corner, drag = smooth, with a **magnifier loupe** above the finger and a floating action bar **[Undo point · Close · Done]**.
Node editing with the **Direct Select** tool: move anchors/handles, convert Corner↔Smooth, add/delete anchor, **Join/Cut** (P1), **Simplify** (P2), reverse direction (P2), open/close path.

**F6 · Rulers & guides (P0)** — §7.5. Horizontal + vertical rulers along the canvas edges (unit-aware, zero at the active page's top-left), cursor position markers, selected-object range highlight, **drag from a ruler to create a guide**, drag back to delete, lock/clear guides, numeric guide position tooltip, corner square = unit switcher. **View tab/sheet** items from reference image 2: Rulers (Ctrl/Cmd+R), Guides (show/lock/clear; Ctrl/Cmd+;), **Smart Guides** (Ctrl/Cmd+U), Grid + Snap-to-grid (Ctrl/Cmd+'), Snap to objects/guides/margins toggles, **Outline mode** (wireframe preview) (Ctrl/Cmd+Y), Pixel preview (P1), Presentation/preview mode (reuse the PPTX `PresentationPreview` pattern), Fit page, Actual size, Zoom in/out, Hide page border.

**F7 · Pathfinder (P0)** — §7.6. Panel **identical to reference image 1**:
*Shape Modes:* Unite · Minus Front · Intersect · Exclude · **[Expand]**
*Pathfinders:* Divide · Trim · Merge · Crop · Outline · Minus Back
Shape Modes create a **live compound shape** (children stay editable until Expand); Pathfinders are immediate. Alt/Option-click on a Shape Mode applies it already expanded (Illustrator behaviour). Available when ≥ 2 shape/path/compound nodes are selected (Expand: when a compound is selected). Disabled-with-reason tooltips otherwise ("Select two or more shapes"). Text must be converted to shapes first (P1 *Convert to outlines*).

### 4.6 Editing features expected of any modern editor (F8–F12)
**F8 · Text (P0).** Point & area text; inline edit on canvas (desktop) and **full-screen composer on compact** (reuse the `MobileTextScreen` / `svg-editor-mobile-text-composer` pattern); font family (the shared grouped list incl. **Arabic group**), size, weight, italic, underline, strike, align (start/center/end/justify), vertical align, line-height, letter-spacing (**auto-disabled for Arabic runs** — tracking breaks joining; show hint), case transform (Latin only), auto direction + manual RTL/LTR, colour/gradient, outline, shadow, highlight background, **number style toggle** (0123 ⇄ ٠١٢٣, P1), text-fit-to-box (P1), text on a circle/arc (P2). v1 styles apply to the whole text box; per-range styles = P1 (data model already `runs`-ready, §7.1).
**F9 · Images (P0).** PNG/JPG/WebP/GIF(first frame)/SVG; EXIF-orientation fix; automatic down-scale of > 4096 px sources (keep original in draft store for export quality up to 4096); **crop** inside its frame (drag/zoom the picture inside the frame), shape-mask via frames (circle, arch, heart…), flip, replace, filters (brightness, contrast, saturation, blur, grayscale, sepia — via SVG `feColorMatrix`, all `RangeControl`s), opacity, shadow. Clipboard paste of images.
**F10 · Arrange (P0).** Align (6), distribute (2), order (4), group/ungroup, lock/unlock, hide/show, flip H/V, duplicate, copy/cut/paste (+ paste in place), nudge pad with step, select all / deselect / select behind, layers panel with thumbnails, rename, drag-reorder, multi-select with Shift, marquee.
**F11 · History (P0).** Undo/redo (100 steps), gesture-grouped (a drag = one step), toasts "Undone: Move". Reset to original (templates: "Restart template").
**F12 · Export & save (P0 / P1).**
* **PDF (P0, primary)** — single or multi-page, page size == design size, Quality: *Screen 96 dpi / Standard 150 dpi / Print 300 dpi*, *Include bleed* (P1), *Crop marks* (P2). Banded rasterisation (no canvas size limits), fonts embedded, Arabic shaped correctly (§7.9).
* **PNG** (1×/2×/3×, transparent background option), **JPG** (quality slider), **SVG** (editable vector; images embedded), **Project file** (`.fdesign.json`, re-openable; also used by the *Test* flow).
* Native app: share sheet (`saveBytes`), web touch: Web Share, desktop: download.
* **Save to My Projects** (needs account): new / replace version dialog identical to the PPTX save dialog.
* **Export report sheet** (like `ReportSheet`): warnings (font fallback, image downscaled, dpi lowered for memory…).

### 4.7 Creative differentiators (what makes this *better than a minimal editor*) — mostly P1
1. **Brand-aware design (EYAD-native).** *Brand* tab pulls `getBrandIdentity(projectId)`: insert **logo** (SVG if available, else raster), **Apply brand colours** (maps template colour roles → brand palette), **Apply brand fonts** (Arabic/English pair), a "Brand colours" swatch row at the top of every colour picker. One tap = on-brand.
2. **One-tap re-theme** with the 20 existing palettes (`ColorPalettePicker`) + live preview thumbnails.
3. **Language flip:** switch template copy AR⇄EN and mirror layout (`mirror: true` templates).
4. **Smart Placeholders:** tap empty photo frame → picker; drop image → auto-cover; "swap image" keeps crop.
5. **Magic Resize** (see F1): create Story/Post/Cover/A5 variants from one design.
6. **Photo-in-shape frames** (circle, arch, heart, blob, hexagon, star) — hugely popular for baby/birthday/business cards.
7. **Handoffs:** *Open in Free Design* action from AI Images / Templates studios (§9 items 13, 16); *Send to Presentation* / *Use as background in Presentation* (P2).
8. **Business Card mode:** 2 pages (front/back), 3 mm bleed, safe margin overlay, "export print-ready PDF with both sides" and **N-up sheet** (P2: 10 cards on A4).
9. **Print-readiness hints:** warns when an image's effective dpi < 150 at its placed size, when text is within 3 mm of the trim, when the design is RGB (info only).
10. **Smart Guides with distance labels** (spacing equalisation) and **snap to equal spacing**.
11. **Colour tools:** recent colours, document colours (auto-collected), eyedropper, "Replace colour everywhere" (P1) — works nicely with SVG imports.
12. **Quick actions bar** that follows the selection (copy / rotate / delete + *Edit text* / *Replace image* / *Crop*) — extends the PPTX `SelectionToolbar` pattern.
13. **Keyboard-complete + touch-complete:** every desktop shortcut has a touch equivalent (sheet/button).
14. **Accessibility:** all controls labelled, focus-visible ring (`2px solid hsl(var(--ring))` offset 2), `prefers-reduced-motion` respected, 44 px touch targets on `(pointer: coarse)`, canvas has an `aria-live` selection announcer.

---

## 5. UX SPECIFICATION (layouts, panels, flows)

### 5.1 Responsive model (identical switching logic to the existing editors)
| Mode | Condition | Layout |
|---|---|---|
| **Compact (phone)** | `(max-width: 767px), (max-height: 520px) and (pointer: coarse)` — **same query as `useCompact()` in `PptxEditorDialog.jsx`** (class `is-compact` on root) | header (compact) · canvas · floating tool rail · bottom `MobileTabBar` · bottom sheets · layers drawer · full-screen text composer |
| **Medium (tablet / small laptop)** | 768–1099 px | ribbon + canvas + **right panel collapsed to the 46 px rail by default**; library panel opens as an **overlay drawer** over the canvas (same animation as `PptxLayersPanel` `pe-lp`) |
| **Wide (desktop)** | ≥ 1100 px | ribbon + tool rail + library panel (collapsible) + canvas + right panel (collapsible) + page strip + footer |
Also respect `(max-width: 660px)` rules the kit already uses (`ek-mobile-tabbar` shown) and `(pointer: coarse)` 40–44 px targets. The editor is `position: fixed; inset: 0; height: 100dvh`, uses `env(safe-area-inset-*)` on top bar / bottom bar, and `useVisualViewport` (copy from `pptxEditor/Sheets.jsx`) so the software keyboard never covers the text composer.

### 5.2 Desktop / Wide layout
```
┌ HEADER ───────────────────────────────────────────────────────────────────────────────────┐
│ [brand icon] Free Design Environment · <file name>   [Undo][Redo]  …  [Templates][Open/Import][Save][Export ▾ PDF][✕] │
├ RIBBON TABS: Home · Insert · Draw · Text · Design · Arrange · View        (+ contextual "Format" when selected) ┤
├ RIBBON GROUPS (art-tile titled groups, 96 px) ───────────────────────────────────────────────┤
├─┬──────────────┬──────────────────────────────────────────────────┬─────────────────────────┤
│T│ LIBRARY      │  ┌ruler──────────────────────────────────────┐   │ PROPERTIES (PanelShell) │
│O│ tabs:        │  │r │                                          │   │  tabs: Properties|Layers │
│O│ Templates    │  │u │         PAGE  (shadow, bleed band,       │   │  Position & size         │
│L│ Elements     │  │l │          guides, smart guides,           │   │  Rotation (half wheel)   │
│ │ Text         │  │e │          selection handles)              │   │  Align / Arrange         │
│R│ Media        │  │r │                                          │   │  Appearance (fill/stroke │
│A│ Backgrounds  │  └──┴──────────────────────────────────────────┘   │   /opacity/effects)      │
│I│              │   floating quick-actions bar near selection        │  Shape / Text / Image /  │
│L│              │                                                    │  Path / Pathfinder       │
├─┴──────────────┴──────────────────── PAGE STRIP (collapsible) ──────┴─────────────────────────┤
│ FOOTER: Page 1 / 3 · zoom [−] [slider] [+] [Fit] [100%] · cursor x,y · hint: shortcuts          │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```
* **Header** (`.fd-top`, same metrics as `.pe-top`: min-height 52, safe-area padding, bottom border, `--card` bg): brand duotone icon + title (`freeEditor.title` = *Test Free Design Environment* / *بيئة اختبار التصميم الحر*) + file-name subtitle; right side actions are `KitIconButton`/`pe-btn-secondary`/`pe-btn-primary` (Export is the primary, with a chevron menu: PDF, PNG, JPG, SVG, Project file). Close = `X` icon button (`data-testid="fd-close"`), with the same dirty-state confirm dialog as the PPTX editor (*Save new / Replace / Discard / Keep editing*).
* **Ribbon** — copy the PPTX ribbon DOM/CSS vocabulary (`pe-ribbon-shell`, `pe-ribbon-tabs`, `pe-ribbon`, `pe-ribbon-group`, `pe-ribbon-button`, `TpGroup` art-titled cards) under the `fd-` prefix. Each group has an **art tile** (see §6.3). Tab contents:
  * **Home** — *Clipboard* (Cut, Copy, Paste, Paste in place) · *Edit* (Undo, Redo, Duplicate, Delete) · *Quick style* (Fill `ColorPopoverField`, Stroke `ColorPopoverField`, Opacity compact wave slider) · *Text* (font `SelectField`, size `Stepper`, B/I/U/S `Segmented`, align `Segmented` — enabled for text) · *Order* (Forward/Back/Front/Back, Group).
  * **Insert** — *Pages* (Add / Duplicate / Delete page) · *Text* (Text box, Heading, Subheading, Body) · *Shapes* (8 most-used + **All shapes…**) · *Media* (Image, SVG, Icons, Frame) · *Library* (Templates, Backgrounds buttons that open the library panel/sheet).
  * **Draw** — *Tools* (Select, Direct select, Pen, Pencil, Line) · *Path* (Add anchor, Delete anchor, Corner⇄Smooth, Close/Open, Join P1, Simplify P2) · **Pathfinder** group = the exact panel of reference image 1 (two rows: *Shape Modes* + Expand, *Pathfinders*) · *Mask* (Put image in shape, Release).
  * **Text** — mirrors the PPTX Text tab cards: Font · Size/Weight sliders (stacked, max two sliders per column like the SVG context bar) · Align · Spacing (line-height, letter-spacing) · Direction (Auto/LTR/RTL) · Case · Colour & highlight · Effects (outline, shadow).
  * **Design** — *Page* (Size/Resize, Orientation, Bleed, Margins) · *Background* (Solid, Gradient, Image, **Library**, Remove) with "apply to all pages" switch (same `pe-scope-card` pattern as "all slides") · *Colour palette* (opens `ColorPalettePicker` + brand palette) · *Fonts* (pairing presets, brand fonts) · *Language* (AR ⇄ EN copy flip / mirror).
  * **Arrange** — *Align & distribute* · *Order* · *Transform* (X/Y/W/H `NumberField`s, lock ratio, rotate 90°, flip H/V) · *Group/Lock/Hide*.
  * **View** — *Zoom* (In/Out/Fit/100 %/slider) · *Show* (**Rulers, Guides, Smart guides, Grid, Margins & bleed, Outline mode**) · *Snap* (Grid, Guides, Objects, Margins) · *Preview* (Present, Pixel preview P1) · *Workspace* (Collapse panels, Reset layout).
  * **Format** (contextual, appears while something is selected; in the PPTX editor the equivalents are the Shapes / Image / Table tabs, which are always visible and enable by selection — **prefer that behaviour: tab always visible, controls enabled by selection**) — Fill, Stroke, Corner radius, Shadow, Image filters, Path tools.
* **Tool rail** (§5.3) · **Library panel** (§5.4) · **Right panel** (§5.4) · **Page strip** (§5.4) · **Footer** (`.fd-foot`, like `.pe-foot`: page x/y, zoom controls, pointer coordinates in the document unit, shortcuts hint).

### 5.3 Tool rail
* Vertical column, 52 px, `--card` background, 1 px border on the inline-end side, buttons are `ek-icon-btn`-styled 40×40 squares (`strokeWidth 1.7`, icon 18 px). Hover: `translateY(-1px)` + primary tint; **press: `scale(.97)`** (the existing tap animation); active tool: `.is-active` (primary tint + border). On tool change the icon plays `sve-icon-pop`.
* Groups separated by `Divider`: [Select · Direct select] · [Pen · Pencil] · [Shapes flyout · Line] · [Text · Image] · [Hand · Zoom · Eyedropper]. Bottom: **fill/stroke chips** (stacked swatches like Illustrator's left toolbar, opens `ColorPopoverField`) and a **swap/default** micro-button.
* **Flyout** (reference image 3): the shapes button shows the last used shape and a tiny corner triangle. Click-and-hold (≥ 350 ms), right-click, or click on the triangle opens a floating card (`ek-popover` look: `--card`, `--ek-radius-md`, `--ek-shadow-lg`, entrance `pe-card-in .36s`) listing *icon · name · shortcut* (Rectangle M, Ellipse L, Triangle, Polygon, Star, Line Segment \\, …, plus "All shapes…"). Selecting a row makes it the rail's current shape tool. Touch: long-press opens it; outside tap closes.
* **Compact:** the rail becomes a **floating vertical pill** at the inline-start edge of the canvas (collapsible via a small chevron; auto-hides while a sheet is open; moves up to avoid the bottom bar; hidden when a text composer is open). All tools are also reachable from the **Draw** bottom tab (sheet), so the floating rail is a convenience, not the only path.

### 5.4 Panels
**Library panel** (start side, `PanelShell side="start"`, collapsible to a rail with vertical title like `.pe-left`): tabs *Templates · Elements · Text · Media · Backgrounds* (icon + label, labels hide under 300 px width → icon-only with `title`).
* *Templates*: category chips, 2-column grid of cards with real ratio, page-count badge, search (P1). Click = **Apply as new design** (if the canvas is empty) or **confirm replace** (`pe-modal`: "Replace current design? / Open in new design") — never silently destroys work.
* *Elements*: sections (collapsible `PropertySection`s): Shapes, Lines & arrows, Frames, Icons (embeds `IconLibraryPicker`), Dividers, Stickers (P1).
* *Text*: Heading / Subheading / Body presets (with Arabic and English examples), **font pairings** (curated AR+EN pairs), "Add text box".
* *Media*: Upload button + drop zone, *My AI images* grid, *Brand logo* tile, recent uploads (from IndexedDB).
* *Backgrounds*: category chips + grid; tap applies to current page (with "apply to all pages" switch).
Drag from any grid onto the canvas also works (desktop); tap-to-insert works everywhere.

**Right panel** (`PanelShell side="end"`, tabs **Properties** / **Layers**; width 304, collapses to 46 px rail; content swaps with `pe-panel-swap`/`pe-swap-in` animation):
* *Nothing selected* → **Page properties**: size (W/H + unit `SelectField`), orientation, bleed, margins, background (Solid/Gradient/Image tabs — same sub-tab behaviour as the SVG editor's Background tab, multi-stop), guides (Show/Lock/Clear), grid size.
* *Selection* → sections (each `PropertySection` with `SubCard`s, exactly the SVG panel's card rhythm): **Arrange** (nudge pad + step, duplicate / group-ungroup / flip / delete stacked in one column, **Rotation `RotationHalfWheel`**, align/distribute for multi-select) · **Size** (scale, W, H, X, Y `NumberField`, lock ratio) · **Appearance** (Fill / Stroke `ColorPickerCard` + gradient editor, opacity & stroke width `RangeControl` stacked, corner radius, dash `PresetPills`, shadow, blur) · contextual **Text**, **Image** (crop, filters), **Shape** (parametric sliders), **Path** (anchor tools), **Pathfinder** (the 10-button panel) .
* **Layers**: `LayerCard` rows (thumbnail, name, eye, lock, drag handle), pointer-based drag-reorder identical to `PptxLayersPanel` (copy its pointer-drag logic; do not use HTML5 DnD), groups collapsible, compound/boolean badges, search (P1).
**Page strip** (below canvas; collapsible; thumbnails rendered by the same scene renderer scaled down; add / duplicate / delete / drag to reorder; current page ring `--primary`).

### 5.5 Dialogs, screens and sheets
1. **Start screen** (`fd-start`, structure of PPTX `Start`): header with close; **three big action cards** — **Blank canvas** (size picker inline), **Templates** (opens gallery), and **Upload image / SVG to test** (`fd-drop`, dashed, drag-drop, `FileUp` icon, identical states `is-over`, busy spinner) — plus the **draft-resume card**, plus a "What is supported / limits" card (formats, 100 MB file cap, 10 000 px page cap, how fonts/Arabic export work).
   *This is the requested **test upload** flow:* the "Test Free Design Environment" pill on the studio page opens the editor in the Start state; picking an image or SVG creates a design **sized to that image** (longest side ≤ 4096 px) with the file placed as a locked, full-bleed layer (user can unlock), and shows a one-time hint toast ("You can draw, mask and export over it"). The same flow accepts a previously exported **`.fdesign.json`** project, so testers can round-trip. Drop is also accepted anywhere on the open editor (adds as a new layer).
2. **Size dialog** (`SizeDialog`): presets list grouped (Social / Print / Screen), custom W×H with unit `Segmented`, orientation toggle, lock ratio, pages stepper, bleed segmented (0 / 3 mm / custom), live proportional preview. Primary "Create design".
3. **Export dialog / sheet**: format `Segmented` (PDF · PNG · JPG · SVG · Project), options per format (PDF: pages range *All / Current / Custom*, quality *Screen / Standard / Print*, include bleed; PNG: scale 1×/2×/3×, transparent; JPG: quality slider), filename field, **estimated output size & dpi** line, primary "Download" with progress (page x of y, band progress) and **cancel**. After success: success `Toast` + optional `ReportSheet` warnings.
4. **Save dialog / Login dialog / Confirm dialog** — reuse the PPTX modal markup (`pe-modal`, `pe-modal-card`, `pe-save-options`, `pe-btn-primary/secondary/danger`) re-scoped as `fd-modal*`.
5. **Template replace confirm**, **Delete page confirm**, **Reset confirm** — `fd-confirm` (same as `pptx-confirm`).
6. **Report sheet** — export/import warnings (font fallback used, image downscaled, SVG features dropped, dpi reduced).
7. **Mobile text composer** — full-screen (`MobileTextScreen` copy) with `dir="auto"` textarea.
8. **Pen action bar (compact)** — floating card above the tab bar with *Undo point · Close path · Done*, and the **loupe** (80 px circle, 2.5× zoom, offset 72 px above the touch point, follows finger, disappears on release).

### 5.6 Compact (phone) layout in detail
* **Header (compact)** `.fd-top`: close ✕ · title/file name · Undo · Redo · **Export** (primary icon button) · ⋯ (opens "More" sheet: Save, Export…, Grid, Rulers, Fit, Report, Reset — same list as the PPTX `more` sheet).
* **Canvas** fills; rulers hidden by default (toggle in View sheet; when shown they shrink to 16 px). Floating tool rail (§5.3). Floating page nav `‹ 2 / 3 ›` (same as `pe-slidenav`) when pages > 1. Selection quick-actions bar floats above the selection (flips below when near the top).
* **Bottom `MobileTabBar`** (`ek-mobile-tabbar`, scrollable, dividers between groups, labels hide < 380 px, active tab icon scales 1.08 + drop-shadow) — tabs in this order:
  `Layers` · `Pages` · | · `Templates` · `Add` (Elements) · `Text` · `Media` · | · `Draw` · `Arrange` · `Size` · `Colors` · `Pathfinder` · | · `Page` (background/size) · `View`.
  Disabled states mirror the SVG editor: *Text/Typography* controls disabled with an explanatory `title` when no text is selected; *Pathfinder* disabled unless ≥ 2 eligible shapes; *Arrange/Size/Colors* disabled when nothing is selected (sheet shows the soft `EmptyCard` "Select an item").
* Tapping a tab opens its **bottom sheet** (`EditorSheet`/`BottomSheet`, grab handle, title row with close, scroll body, optional sticky footer, `max-height: min(60dvh,620px)`; `tall` = `min(72dvh,760px)`; open `pe-sheet-up .4s cubic-bezier(.16,1,.3,1)`, close `pe-sheet-down .2s` via the **ghost-sheet pattern** (`closing` + `--pe-closing-bottom`), children cards fade up in sequence with `pe-card-in` delays 0/.04/.08/.12 s). While a sheet is open the canvas re-fits into the remaining space (the PPTX canvas already does this — replicate the behaviour: `keepInView`/refit when `sheet` changes).
* **Layers** opens the animated **layers drawer** (`pe-lp` pattern) with a dim backdrop; **Templates / Media / Backgrounds** open tall sheets with 2-column grids; **Elements** opens a tall sheet with category sections + search (exactly like `pptx-shape-sheet`).
* **Gestures:** one-finger drag on empty canvas = swipe page (if zoom ≤ 1.02, no draw tool) else pan; two-finger = pan+pinch zoom; double-tap = zoom toggle; long-press object = context quick-actions; draw tools capture the one-finger drag (no swipe). Handles are 44 px hit-areas drawn 16 px.
* **Landscape phones** (`max-height:520px` + coarse): bottom bar becomes the compact single-row bar; sheets use `max-height: 70dvh` and open as side sheets (reuse the PPTX landscape rule block `@media (max-height:520px) and (pointer: coarse)`).

### 5.7 Canvas overlays (all in screen space, drawn above the scene)
Selection frame + 8 handles + rotate handle (`pptx-handle` visuals: 12 px white square, 2 px primary border, rotate = filled primary circle 34 px above; 16 px on compact) · marquee (`pptx-marquee` look) · **smart guides** (red lines like PPTX; snap only when pointer speed < `SNAP_MAX_SPEED`) with **distance labels** · user **guides** (cyan, 1 px, draggable) · rulers · margin/bleed overlay · pen path preview (primary stroke, anchors as 7 px squares, handles as 5 px circles with lines) · node-edit overlay · crop overlay (dims outside the frame) · dimension tooltip while resizing (`312 × 180`) and angle tooltip while rotating · placeholder frame chrome (dashed, "+" icon, label) · pasteboard dimming outside the page.

### 5.8 State/empty/error handling (every surface)
Loading (skeletons / spinner with `pe-spin`), empty libraries (`EmptyCard`), offline (templates list cached for the session; backgrounds & shapes are bundled so the editor works offline), file errors (typed codes → localised messages via a `freeMessages.js` like `presentationMessages.js`), import warnings, export failures (design stays open, retry), editor chunk load failure (boundary + retry, copy of `PptxEditorLoadBoundary`), autosave failure (silent, `console.warn`), quota exceeded for IndexedDB (toast "Draft could not be saved").

### 5.9 Motion & feedback catalogue (use only these; all honour `prefers-reduced-motion`)
Overlay `sve-overlay-in .3s` · dialog `sve-dialog-in .35s` · sheet up `.4s` / down `.2s` · card stagger `pe-card-in .36s` · panel swap `pe-swap-in` · toast `sve-toast-in` · active tab icon `sve-icon-pop` · button hover `translateY(-1px)` / press `scale(.97)` (`ek-icon-btn`, `ek-mobile-tab`, `ek-action`) · spinner `pe-spin` · swipe settle (copy `useSwipeNav` transitions). Easing tokens only: `cubic-bezier(.4,0,.2,1)` (fast/normal) and `cubic-bezier(.16,1,.3,1)` (smooth/spring). **No new easing curves, no bouncy overshoot, no parallax.**

### 5.10 Keyboard map (desktop; shown in the footer hint and a "Shortcuts" sheet)
V select · A direct select · P pen · N pencil · M rectangle · L ellipse · `\` line · T text · I image · H hand (hold Space) · Z zoom · E eyedropper · Ctrl/⌘ +Z / +Shift+Z (or +Y) undo/redo · +C/X/V · +Shift+V paste in place · +D duplicate · +G / +Shift+G group/ungroup · +] / +[ forward/back (+Shift = front/back) · +A select all · Esc deselect/finish tool · Delete/Backspace · Arrows nudge (Shift ×10) · +R rulers · +; guides · +U smart guides · +' grid · +Y outline mode · +0 fit · +1 100 % · +/− zoom · Enter on pen finishes · Tab hides panels (P2). On macOS use ⌘; on Windows/Linux Ctrl (detect with `navigator.platform`).

---

## 6. UI COMPLIANCE CHECKLIST (follow *exactly*)

### 6.1 Tokens & typography
* Use app CSS variables only (`hsl(var(--primary))` etc.) and the kit tokens (`--ek-*`). **No hard-coded brand colours** except semantic ones the editors already hard-code: danger `#e11d48` / `hsl(0 72% 51%)`, guides red (smart) and cyan (user guides), selection handles as in `.pptx-handle`.
* Fonts: root uses `font-family: var(--font-body)`, `font-size: 13px` (editor chrome is 11–13 px, titles 14–15 px, tab labels 10–11 px, matches `.pe-root`/`.svg-editor-dialog`). Arabic chrome text falls back to `--font-arabic` (Cairo) automatically through `html[lang=ar]`. Inputs on touch are `font-size:16px` (prevents iOS zoom — see `.pe-input`).
* Radii: 8 (controls) / 12 (cards) / 16–20 (sheets, modals), as in `--ek-radius-*`. Shadows: `--ek-shadow-sm/md/lg`.

### 6.2 Components: must come from `editorKit`
| Need | Use |
|---|---|
| Any slider (opacity, stroke width, radius, font size, letter/line spacing, polygon sides, star points/ratio, shadow blur/offset, filters, smoothing, zoom) | `RangeControl` (wave) — layouts `default / compact / editable`; commit-on-release (omit `onLive`) **or** live + commit (`onLive` + `onCommit` + `onLiveCancel`) — live for anything that changes the canvas |
| Rotation (objects, gradient angle, star/polygon rotation) | `RotationHalfWheel` (+ presets row) |
| Numeric fields (X, Y, W, H, page size) | `NumberField` (commit on blur/Enter, ↑↓ step, comma→dot) ; toolbars: `Stepper` |
| Colours | `ColorPickerCard` (panel), `ColorPopoverField` (ribbon/toolbars), `ColorSwatches`; gradient stops editor = new composite built from these (see 6.4) |
| Toggles / selects | `SwitchRow`, `SelectField` (grouped options for fonts), `Segmented`, `PresetPills` |
| Action buttons | `ActionGrid` + `QuickAction`, `KitIconButton` |
| Panels | `PanelShell`, `PropertySection`, `SubCard`, `EmptyCard`, `LayerCard`, `NudgePad` |
| Mobile | `MobileTabBar`, `EditorSheet` (via a `BottomSheet` wrapper), `Toast` |
| Icons | lucide-react (`strokeWidth={1.7}`; 14/16/18/20/22 px) for actions; **duotone `Icon` wrapper + `TINT` pattern from `editorKit/icons.jsx`** for tab-bar/tool glyphs that lucide lacks |
Do not use native `<input type="range">`, native `<select>` for styled pickers (the kit's `SelectField` wraps one properly), or shadcn `Slider` default variant. `ui/slider.jsx` `variant="wave"` is already what `RangeControl` uses.

### 6.3 Host-owned CSS contract (important discovery)
`EditorSheet`, `Toast`, `PanelShell`, etc. are **only partially styled by `editorKit.css`**: `EditorSheet` emits the classes `pe-sheet pe-sheet-grab pe-sheet-head pe-sheet-body pe-sheet-foot` (and `Toast` is combined with the host's `pe-toast`), and their rules live in **`pptxEditor.css`** (lines ≈129-136 and the "BOTTOM SHEET MOTION" block ≈536-560). Since we cannot import `pptxEditor.css` without leaking `.pe-root`-scoped styles, **`freeDesign.css` must re-declare those rules scoped under `.fd-root`** (`.fd-root .pe-sheet {…}`, `.fd-root.is-compact .pe-sheet {animation: pe-sheet-up …}` etc.). Procedure for the implementer:
1. Open `pptxEditor.css`; copy (do not move) the rule groups: root/reset, top bar, buttons (`pe-btn*`), ribbon (+ `TpGroup` `pe-tp-*`), sheets & sheet motion, bottom bar, modal (`pe-modal*`), toast, busy overlay, start screen (`pe-start*`, `pe-drop`, `pe-card`), slide-nav, handles/marquee/guides (`pptx-handle`, `pptx-marquee`, selection frame), layers drawer (`pe-lp*`), present mode (`pe-present*`), panel swap/reveal keyframes.
2. Re-scope selectors: host classes `pe-` → `fd-`, `pptx-` → `fd-`; **kit-emitted `pe-sheet*` selectors stay as is but are prefixed by `.fd-root`**. Keyframe names: reuse the existing global names (`pe-sheet-up`, `pe-sheet-down`, `pe-card-in`, `sve-*`) **only if** they are guaranteed loaded — they are defined in `pptxEditor.css`/`editorKit.css`; because `editorKit.css` is always imported but `pptxEditor.css` is lazy, **re-declare the `pe-*` keyframes under new names `fd-sheet-up/down`, `fd-card-in`, `fd-swap-in`, `fd-panel-reveal`, `fd-fade-in`, `fd-spin`, `fd-art-pop`, `fd-tab-in` with identical timing/easing** to avoid load-order bugs.
3. Keep the same z-indexes (root 10000; error boundary 10001; text composer 100000; toast 60 inside the root).
4. `svgEditor.css` rules that `editorKit.css` says it was "ported from" are already inside the kit — do not import `svgEditor.css`.

### 6.4 Kit gaps (allowed additions, prefix `ek-`, appended at the *end* of `editorKit.css` under a banner `FREE DESIGN KIT ADDITIONS`)
Only add what truly does not exist, implemented in the kit's style (same tokens, hover/active/focus rules, coarse-pointer sizes):
* `GradientEditor` (bar preview with draggable stops, selected-stop `ColorPickerCard`, angle `RotationHalfWheel`, linear/radial `Segmented`) — composed from existing parts; file `editorKit/GradientEditor.jsx`.
* `ToolFlyout` (button + corner triangle + popover list with shortcuts) — `editorKit/ToolFlyout.jsx`.
* `RulerStrip` is *not* a kit control (editor-specific) → lives in `freeDesign/`.
If you add kit files, export them in `editorKit/index.js` (append lines only).

### 6.5 Icons to author (duotone, 24×24 grid, 1.7 stroke, `TINT` 16 %) in `freeDesign/ui/fdIcons.jsx` using the kit `Icon` wrapper
Tools: `SelectIcon` (use lucide `MousePointer2`), `DirectSelectIcon`, `PenIcon` (kit has one), `PencilIcon`, `NodeAdd/NodeDelete/NodeCorner/NodeSmooth`, `FrameIcon`, `RulerIcon`, `GuideIcon`, `SmartGuideIcon`, `GridIcon`, `OutlineModeIcon`, `PagesIcon`, `TemplatesIcon`, `BackgroundsIcon` (kit has one), `ElementsIcon`, `MediaIcon`, `BrandIcon`, `PathfinderIcon`.
**Pathfinder glyphs (10)** — drawn from two overlapping rounded squares (back at 3,3–13,13; front at 9,9–19,19), colours via `currentColor` + tint opacity, matching Illustrator semantics of reference image 1:
| Glyph | Drawing |
|---|---|
| Unite | single filled union silhouette |
| Minus Front | back square filled, front square outline only (carved) |
| Intersect | both outlines, intersection filled |
| Exclude | both filled, overlap hollow (evenodd) |
| Divide | both outlined + overlap outlined, three regions tinted |
| Trim | back filled minus overlap, front filled (no overlap stroke) |
| Merge | like Trim but one tint across regions (merged) |
| Crop | front outline faint, only intersection filled |
| Outline | all three regions as hairline outlines only |
| Minus Back | front square filled, back outline carved |
Plus an `Expand` glyph (square with outward arrows). Provide `aria-label`/`title` from i18n (`freeEditor.pf.unite`…).
**Ribbon group art tiles:** the PPTX/SVG editors use small multi-colour illustration SVGs (`pptxEditor/icons/*.svg`, `svgEditor/icons/*.svg`, viewBox ≈ 52×52, palette `#67D3FB` and friends) as group titles. **Open 3–4 of them, copy their palette and line weight, and author matching SVGs** in `freeDesign/icons/`: `pages.svg, tools.svg, pen.svg, pathfinder.svg, rulers.svg, templates.svg, backgrounds.svg, export.svg, page-size.svg, brand.svg, language.svg, frames.svg`. Reuse existing ones where the meaning matches (`clipboard.svg, shapes.svg, objects.svg, transform.svg, zoom.svg, workspace.svg, slideBackground.svg, colorPalette.svg, image.svg, media.svg, paragraph.svg, actions.svg`) by importing them with the `Copy as asset` approach (`import art from "@/components/pptxEditor/icons/clipboard.svg"` is a read-only asset import and is allowed; it does not couple code).

---

## 7. TECHNICAL ARCHITECTURE

### 7.0 Folder / file plan (new files only; the only *edited* existing files are in §9)
```
src/
├─ pages/
│  ├─ FreeDesignStudio.jsx            # landing page (§4.1) + lazy editor host + test button
│  └─ freeDesignStudio.css            # page-level styles (prefix fd-page-)
├─ studios/freeDesign/
│  ├─ sizes.js                        # presets (§4.2 F1), unit helpers re-export
│  ├─ categories.js                   # template + background categories {id, slug, name:{en,ar}, icon}
│  ├─ shapesLibrary.js                # shape catalogue → {id, group, nameKey, build(params)} (uses engine/shapes)
│  ├─ fontPairs.js                    # curated AR+EN heading/body pairs
│  ├─ shortcuts.js                    # shortcut table (single source for handlers + help sheet)
│  ├─ templates/                      # bundled starter templates (JSON-producing builders, §8.4)
│  │   ├─ index.js  helpers.js  social.js  business-cards.js  newborn.js  birthdays.js  flyers.js  brochures.js  invitations.js  posters.js  menus.js  certificates.js  seasonal.js
│  └─ backgrounds/
│      ├─ index.js  gradients.js  geometric.js  patterns.js  abstract.js  floral.js  festive.js  pastel.js  dark.js  arabesque.js  paper.js
├─ components/freeDesign/
│  ├─ FreeDesignEditor.jsx            # default export — the full-screen editor (portal), like PptxEditorDialog
│  ├─ FreeDesignEditorHost.jsx        # lazy + error boundary + suspense + retry (copy of PresentationEditorHost pattern)
│  ├─ freeDesign.css                  # ALL editor styles, scoped under .fd-root (§6.3)
│  ├─ state/        useEditorState.js  history.js  selection.js  clipboard.js  useViewState.js  useDraft.js
│  ├─ canvas/       Canvas.jsx  SceneView.jsx  Thumb.jsx  overlays/{Selection,Marquee,SmartGuides,UserGuides,Rulers,Margins,PenPreview,NodeEdit,CropOverlay,DimTooltip,PlaceholderChrome}.jsx
│  │                tools/{index.js,select.js,direct.js,pen.js,pencil.js,shape.js,text.js,image.js,hand.js,zoom.js,eyedropper.js}
│  ├─ ribbon/       Ribbon.jsx  RibbonGroup.jsx  tabs/{Home,Insert,Draw,Text,Design,Arrange,View,Format}.jsx
│  ├─ panels/       LibraryPanel.jsx  library/{TemplatesTab,ElementsTab,TextTab,MediaTab,BackgroundsTab}.jsx  PropertiesPanel.jsx
│  │                sections/{Arrange,Size,Appearance,Shape,Text,Image,Path,Pathfinder,PageProps}.jsx  LayersPanel.jsx  PageStrip.jsx  PathfinderPanel.jsx
│  ├─ mobile/       tabs.js  sheets/*.jsx  FloatingToolRail.jsx  PenActionBar.jsx  Loupe.jsx  PageNav.jsx
│  ├─ dialogs/      Start.jsx  SizeDialog.jsx  ExportDialog.jsx  SaveDialog.jsx  LoginDialog.jsx  ConfirmDialog.jsx  ReportSheet.jsx
│  ├─ ui/           BottomSheet.jsx (copy)  MobileTextScreen.jsx (copy)  useVisualViewport.js (copy)  fdIcons.jsx  ToolRail.jsx  ToolFlyout use (kit)  RibbonButton.jsx
│  ├─ icons/        *.svg (art tiles, §6.5)
│  └─ engine/       (PURE — no React, no DOM except where noted; all unit-testable under node:test)
│       schema.js        # createDocument, createPage, createNode, validateDocument, migrate, constants
│       ids.js  units.js  matrix.js  geometry.js (copied+adapted from pptx)  
│       path.js          # contours, parse/serialize d, flatten, bbox, hit, split, add/delete/convert anchors, fitCurve
│       shapes.js        # shapePath(node), presets (copied+adapted presetGeometry), seeded blob, star/polygon/heart…
│       ops.js           # immutable document operations (§7.2)
│       align.js         # align / distribute
│       snap.js          # snapping + smart guides + equal spacing
│       ruler.js         # ticks algorithm, guide helpers
│       boolean.js       # Pathfinder via paper.js (dynamic import) (§7.6)
│       text.js          # layoutText, bidi/script detection, font loading, measure cache
│       theme.js         # roles, applyPalette, applyBrand, applyLanguage
│       vnode.js         # scene → VNode tree (single source of truth for screen + export) (§7.9)
│       svgOut.js        # VNode → SVG string; defs/ids; font embed hook
│       fonts.js         # collectUsedFonts, fetch+embed Google font subsets, cache
│       raster.js        # banded rasterisation (SVG → canvas bands)
│       exportPdf.js  exportImage.js  exportSvg.js  exportProject.js  (dynamic imports of jspdf/jszip)
│       importImage.js  importSvg.js  importProject.js  assets.js (IndexedDB asset store)
│       draftStore.js    # IndexedDB drafts
│       magicResize.js   # P1
├─ services/
│  ├─ freeDesignService.js            # save/list/load project versions (Supabase) + handoff helpers
│  └─ freeDesignContentService.js     # template/background catalogue from Supabase + bundled fallback
└─ i18n/translations.js               # + freeStudio.* and freeEditor.* keys (EN + AR) — §10
supabase/migrations/<ts>_free_design_studio.sql   (§8.1)   supabase/seed/free_design_samples.sql
scripts/build-free-design-content.mjs                    (§8.4: generates template/background JSON + thumbnails + SQL)
tests/reliability/free-design-*.test.js                  tests/e2e/free_design_{desktop,mobile,rtl}.py   (§12)
```

### 7.1 Document model (schema v1) — the contract of everything
Plain JSON, immutable updates with **structural sharing** (history = array of previous document *references*, no deep copies).
```js
FdDocument = {
  v: 1, id, name,
  unit: "px" | "mm" | "cm" | "in",         // display unit (rulers, inputs)
  pages: Page[],                           // 1..50
  assets: { [assetId]: { kind:"image"|"svg", mime, w, h, bytes? } },  // blobs live in IndexedDB / storage, never in this JSON
  meta: { createdAt, updatedAt, templateId?:string, lang:"ar"|"en",
          theme: { roles:{bg,ink,primary,accent1,accent2}, fonts:{heading:{ar,en}, body:{ar,en}}, paletteId? },
          view: { rulers:true, guides:true, guidesLocked:false, smartGuides:true, grid:{show:false,snap:false,size:10},
                  snapObjects:true, snapGuides:true, snapMargins:true, outline:false } }
}
Page = { id, name, w, h,                    // CSS px @96dpi, 1..10000
         bleed: 0 | number,                 // px, uniform
         margin: number,                    // px safe-area inset (overlay only)
         bg: Paint | null,                  // page background fill (default solid white)
         bgRef?: { libId, mode:"cover"|"stretch"|"tile" },   // set when a library background is applied (replaceable)
         guides: { x:number[], y:number[] },
         nodes: Node[] }                    // z-order: index 0 = bottom
Node (common) = { id, type, name?, x,y,w,h, rot:0, flipH:false, flipV:false, opacity:1,
                  hidden:false, locked:false,
                  style:{ fill:Paint|null, stroke:null|{ paint:Paint, width, dash:number[], cap:"butt"|"round"|"square", join:"miter"|"round"|"bevel", miter:4 },
                          shadow?:{ x,y,blur,color,alpha }, blur?:number },
                  anchor?:{ h:"scale"|"start"|"end"|"center", v:"scale"|"start"|"end"|"center" }, // magic-resize rules
                  placeholder?: { kind:"image"|"text", labelKey } }                               // template fields
Paint = { t:"solid", c:"#RRGGBB", a:1 }
      | { t:"linear", angle:0..360, stops:[{o:0..1,c,a}] }
      | { t:"radial", cx:.5, cy:.5, r:.5, stops:[…] }
      | { t:"role", role:"bg"|"ink"|"primary"|"accent1"|"accent2", a:1, shade?:-1..1 }   // resolved through meta.theme → re-theming
Node types:
  rect     { rx:[tl,tr,br,bl] }                 ellipse {}               polygon { sides:3..20 }
  star     { points:3..20, inner:0.1..0.95 }    line { arrowStart, arrowEnd: "none"|"arrow"|"dot"|"bar" }   (open; stroke only)
  preset   { prst:string, adj:{[k]:number} }    // any shape from the copied presetGeometry catalogue
  path     { contours:[{ closed:boolean, nodes:[{ x,y, hi:{x,y}|null, ho:{x,y}|null, t:"corner"|"smooth"|"sym" }] }], fillRule:"nonzero"|"evenodd" }
           // hi/ho are handle OFFSETS relative to the anchor; coordinates are local to the node box (0..w, 0..h)
  text     { content:string, font:{ family, weight, italic }, size, color via style.fill, align:"start"|"center"|"end"|"justify", valign, lineHeight:1.2,
             tracking:0, dir:"auto"|"ltr"|"rtl", caseT:"none"|"upper"|"lower"|"title", underline, strike, autoH:true, fit:false,
             outline?, highlight?:{c,a,pad}, runs?:null /* P1 per-range styles; v1 always null */, numerals:"auto"|"latin"|"arabic" }
  image    { assetId|null, crop:{x,y,w,h}, scaleMode:"cover"|"contain", shape:null|{kind,params}, filters:{brightness,contrast,saturation,blur,grayscale,sepia}, flip? }
           // assetId null + placeholder => empty frame
  group    { children:Node[] }                  // children coordinates are LOCAL to the group's top-left (unrotated); group x,y,w,h = union bbox
  compound { op:"unite"|"subtract"|"intersect"|"exclude", children:Node[] }   // live Shape-Mode result; geometry computed lazily, cached
```
* **Units:** `x,y,w,h`, sizes, blur etc. are px (floats). Rotation degrees (stored 0–359 like PPTX; UI wheel uses −180…180 via `normalizeAngle`).
* **Roles:** template fills/strokes/text colours use `{t:"role"}`; resolving = `theme.roles[role]` with optional lightness `shade`. User-picked colours become `solid`. "Convert roles to colours" happens implicitly when the user picks a custom colour for that node.
* **Versioning:** `v` + `migrate(doc)`; unknown newer versions are rejected with a typed error; every release that changes the schema bumps `v` and adds a migration + test.
* **Ids:** `nanoid`-style 10-char (implement in `ids.js`; no dependency). Unique within a document.
* **Validation:** `validateDocument(json)` (hand-written): caps — pages ≤ 50, nodes ≤ 10 000 total, tree depth ≤ 12, strings ≤ 20 000 chars, numbers finite and clamped, enums whitelisted, asset ids referenced exist (or are replaced by empty placeholders with a warning).

### 7.2 State, operations, history (`state/` + `engine/ops.js`)
* **Editor state** (React `useReducer` or a tiny store — pick `useReducer` to stay dependency-free): `{ doc, activePageId, selection:string[], isolation:null|string, nodeEdit:null|{id,anchors:Set<string>}, tool, toolOptions, view:{zoom,pan}, ui:{sheet, ribbon, panels…} }`. **History lives beside it:** `{ past:FdDocument[], future:FdDocument[] }` (max 100). View state (zoom/pan, selection) is *not* in history (unlike the SVG editor which stores zoom in snapshots — we keep it simple and predictable).
* **Commit protocol (copy the PPTX pattern):** `commit(label, nextDoc, {selection?})` pushes one history entry. **Live gestures** (drag, resize, rotate, slider scrub, colour picker drag) write to `liveOverrides: Map<id, Partial<Node>>` (ref + rAF-coalesced setState) that the renderer overlays on the doc; on release → one `commit`. Sliders use `onLive` + `onCommit` + `onLiveCancel` of `RangeControl`.
* **Ops (pure, return a new doc):** `addNode(doc,pageId,node,{index})`, `removeNodes`, `updateNodes(doc,pageId,ids,patch|fn)`, `setBounds(doc,pageId,boundsById)` (group-aware, recomputes parents), `moveBy`, `resizeNodes(handle, box)` (paths scale their points; text scales box (+font size if "scale text" toggled); images keep crop ratio), `rotateNodes`, `flipNodes`, `groupNodes`, `ungroupNode`, `reorder(ids, "forward"|"backward"|"front"|"back"|toIndex)`, `align(ids, mode, ref:"selection"|"page")`, `distribute`, `duplicateNodes (offset 16 px)`, `pasteNodes (+in place)`, `addPage/duplicatePage/deletePage/movePage/renamePage`, `setPageSize(doc,pageId,w,h,{resizeContent:"none"|"scale"|"anchors"})`, `setPageBackground`, `applyTheme(doc, palette|brand)`, `setLanguage(doc, lang)`, `toPath(node)`, `booleanOp`, `expandCompound`, `makeFrame(shapeId,imageId)`/`releaseFrame`, `setImageCrop`, `setFilters`, `fillPlaceholder(nodeId, assetId)`, `lock/hide/rename`, `convertRolesToSolid`.
* **Selection rules:** click selects the top-most hit *within the current isolation scope* (group content only after double-click-enter); Shift/Ctrl-click toggles; marquee selects intersecting nodes at the current scope; locked & hidden nodes are not selectable on canvas (selectable in Layers to unlock); selection across scopes is not allowed (clear on isolation change).
* **Clipboard:** internal (`structuredClone` of nodes with fresh ids on paste, assets preserved) + best-effort system clipboard: paste of an image blob → new image node; paste of SVG text (`image/svg+xml` or text starting `<svg`) → SVG import; paste of plain text → new text node.
* **Dirty tracking:** `doc !== savedDoc` reference check (cheap); `beforeunload` warning + draft flush identical to PPTX (`visibilitychange`, `pagehide`).

### 7.3 Path engine & Pen tool (`engine/path.js`, `canvas/tools/pen.js`, `direct.js`, `pencil.js`)
**Path utilities (pure):** `parsePathD(d) → contours` (M L H V C S Q T A Z, absolute+relative; **A → cubic** using the standard arc→bézier conversion; Q/T → cubic), `contoursToD(contours)`, `bboxOfContours` (exact cubic extrema, not control-point hull), `flatten(contours, tol)` (adaptive subdivision), `closestPoint(contours, pt) → {contour, seg, t, point, dist}`, `splitSegment(contours, contour, seg, t)` (de Casteljau → inserts an anchor preserving the curve), `deleteAnchor`, `convertAnchor(node, "corner"|"smooth")` (smooth: tangent = normalised(next − prev), handle length = ⅓ of the distance to each neighbour; corner: remove handles), `joinPaths`, `reverse`, `simplifyContours` (RDP + `fitCurve`), `fitCurve(points, error)` (Schneider's algorithm), `translate/scale/rotate/transform(contours, matrix)`, `normalizeNode(node)` (recompute bbox from contours, shift origin, **keep every anchor's world position invariant even when `rot ≠ 0`** by compensating `x,y` through the rotation about the old/new centre).
**Pen interaction (state machine):**
| Event | Behaviour |
|---|---|
| pointerdown, no active path | start contour, place anchor A0 (corner, no handles); `draft = path` |
| drag after down | pull `ho` out of the new anchor, mirror `hi` (smooth-symmetric); **Alt** breaks the mirror; **Space** repositions the anchor instead; **Shift** constrains the handle to 45° |
| pointerup | anchor committed to the draft |
| pointermove (no button) | rubber-band: draw the segment from the last anchor to the pointer using the last `ho` (live curve), snap to guides/grid/objects/angles |
| down on first anchor | **close** the contour (drag = adjust its handles) → path is finished and selected |
| down on last anchor | turn it into a corner (remove `ho`) (Illustrator "cusp"); down on another anchor of the *same* open path = no-op |
| Enter / double-click / Done button | finish **open** path |
| Esc | cancel the active draft (or if ≥ 2 anchors, finish — configurable; default finish to avoid data loss) |
| Backspace/Delete | remove the last anchor (Undo point button on touch) |
| hover over an existing selected path segment | cursor "+" → click inserts anchor (via `splitSegment`) |
| hover over an existing anchor with Pen | cursor "−" → click deletes it |
| hover over an end anchor of another open path | click **continues** that path (merge if both ends) |
Result node: `type:"path"`, style = last used path style (default fill none, stroke `ink` 2 px, round caps/joins) — closed paths default fill `primary` @ 100 %? **Decision:** closed → fill = tool's current fill; open → fill none. Draft preview rendering is a screen-space overlay; committing creates **one** history entry for the whole path.
**Direct-select/node edit:** double-click a path (or choose A) → anchors (7 px squares, selected = filled primary), handles (5 px circles) of selected anchors; drag anchors/handles; marquee-select anchors; Shift-add; arrow keys nudge selected anchors; `Alt`-drag a handle = break; context bar buttons: Add / Delete / Corner / Smooth / Join / Cut (P1). Parametric shapes are converted to `path` on first node edit (auto, with undo toast "Shape converted to path"). Touch: anchors/handles have 44 px hit areas; tap anchor selects, drag moves; long-press on segment adds anchor.
**Pencil:** collect samples (min spacing 2/zoom px), live polyline preview; on release `simplify` with tolerance from the *Smoothing* `RangeControl` (0–100 → 0.5–8 px ÷ zoom) → `fitCurve` → open path (closed if the end is within 10 px of the start).
**Hit-test:** closed + filled → point-in-contours (winding by flattened polygon); stroked → `dist ≤ strokeWidth/2 + tol` (tol = 6/scale, 10 coarse); open unfilled → stroke only; text → box; image → box (or shape contour).

### 7.4 Shapes (`engine/shapes.js`)
* `shapeContours(node)` for every parametric type → contours (used by Pathfinder, hit-test, outline mode, SVG `d`). **Rect** uses native `<rect rx>` when radii are equal else `<path>`; ellipse native; others `<path d>`. Rounded corners → cubic with `k = 0.5522847498`. Per-corner radii clamped to half the shorter side.
* Catalogue copied/adapted from `pptxEditor/engine/shapes.js` `presetGeometry` (`kind: rect|ellipse|path|custom` with `adj` arguments) so the *All shapes* sheet has the same categories (basic, lines, arrows, stars, callouts, flow) **plus** Free-Studio extras not in PPTX: heart, cross/plus, ring (compound hole, evenodd), arch (boho), semicircle, blob (seeded closed smooth path, 6–9 anchors, `seed` param → "Shuffle" button), burst/badge (star with 12–24 points + optional roundness), ribbon/banner, speech bubble (rounded rect + tail), cloud, droplet, leaf, crescent, wave line, squiggle, zigzag, diagonal stripes (as pattern fill P2).
* Parametric sliders per type are declared in the catalogue (`params:[{key,labelKey,min,max,step,default}]`) so the Shape section renders itself from data.
* `toPathNode(node)` converts any shape to a `path` node (used by node edit, Pathfinder, Expand, mask).

### 7.5 Units, rulers, guides, grid, snapping (`engine/units.js`, `ruler.js`, `snap.js`)
* `PX_PER = { px:1, in:96, cm:96/2.54, mm:96/25.4 }`; `toUnit/fromUnit`; `formatUnit(value, unit)` → decimals px 0, mm 1, cm 2, in 3 (trim trailing zeros). `NumberField` suffix = unit label; internal always px.
* **Ruler ticks:** `rulerTicks({ min, max, scale, unit }) → [{ pos(px), label?, level:0|1|2 }]`. Major step chosen from the 1-2-5 series × unit (in: also 1/16…1/2 binary steps) so that majors are ≥ 64 CSS px apart on screen; level-1 = ×½/÷5, level-2 = finer; labels only on major ticks; draw on a `<canvas>` sized `devicePixelRatio`, redrawn in rAF on pan/zoom/selection/unit change. Ruler thickness 20 px desktop, 16 px compact. **Rulers are physical-left/top in both LTR and RTL** (the canvas is LTR). Zero = active page's top-left (bleed is *outside* zero, shown as negative values). Corner square: click cycles/open unit popover; double-click resets view (P1: reset origin).
* **Selection range highlight** on both rulers (tinted band of the selection's bounding box) and **pointer markers** (1 px line following the cursor).
* **Guides:** `page.guides.x/y` (px). Create by pointer-down on a ruler and dragging onto the canvas (live line + numeric tooltip in document unit); drag to move; drag back into the ruler (or press Delete while hovered/selected) to remove; `meta.view.guidesLocked` blocks edits; *Clear guides* in View. Hit tolerance 6 px (10 coarse). Guides are drawn above the scene, never exported. On touch: drag from the ruler works (rulers are shown at 16 px only when enabled).
* **Grid:** `meta.view.grid {show, snap, size}` (size in the doc unit); drawn only when a cell ≥ 8 screen px.
* **Snapping:** `buildSnapTargets(page, excludeIds, view)` → `{ xs:[{v,kind}], ys:[…] }` with kinds `page, pageCenter, margin, bleed, guide, grid, objEdge, objCenter`. Threshold `6/scale` px (`8/scale` coarse). Each snap test uses the *rotated bounding box* of the moving selection (edges + centre). **Smart guides** draw lines to the matched targets (red, as PPTX) and **distance labels**; **equal-spacing snap** when the moving box makes two neighbouring gaps equal (draw both gap brackets). Snapping is **speed-gated** (`SNAP_MAX_SPEED = 0.45 px/ms`) exactly like the PPTX canvas, disabled with **Ctrl/⌘** held, rotation snaps every 15° (Shift or within 3°), resize snaps edges/centres. Snap kinds toggle independently in *View → Snap*.

### 7.6 Pathfinder (`engine/boolean.js`) — exact semantics
**Dependency:** `paper` (paper.js). Load lazily: `const paper = (await import("paper/dist/paper-core")).default; paper.setup(new paper.Size(1, 1));` once (module singleton). Use only geometry (`Path`, `CompoundPath`, `unite/subtract/intersect/exclude/divide`, `.area`, `.closed`, `.fillRule`). *Pin the version in package.json (0.12.x).* Add a tiny adapter layer so the library can be swapped (`polygon-clipping` is the documented fallback, polygons only).
**Adapters:** `toPaper(node, worldMatrix)` → `paper.CompoundPath|Path` from `shapeContours(node)` transformed to **page space** (rotation/flips baked); `fromPaper(item) → {contours, fillRule}` (segments ↔ our `{x,y,hi,ho}`, `handleIn/Out` are already offsets; set `t` by collinearity).
**Eligibility:** rect, ellipse, polygon, star, preset, closed or open `path` (open ones are closed for filling), `compound`; groups are *flattened one level* to their eligible leaves; `text`/`image`/`line` are not eligible (hint tooltips: "Convert text to shapes first" P1 / "Pathfinder works on shapes and paths"). Minimum 2 inputs (except *Expand*, *Outline*).
**Ordering & result style:** inputs are sorted by z-order (back → front). The result replaces the inputs **at the z-index of the top-most input** and becomes the selection. One history entry per click.
| Button | Mode | Algorithm (inputs `S1…Sn`, back→front) | Result style |
|---|---|---|---|
| **Unite** | live compound | `S1 ∪ S2 ∪ … ∪ Sn` | top-most input's fill/stroke |
| **Minus Front** | live compound | `S1 − (S2 ∪ … ∪ Sn)` | back-most input's style |
| **Intersect** | live compound | `S1 ∩ S2 ∩ … ∩ Sn` | top-most input's style |
| **Exclude** | live compound | XOR chain (areas covered an odd number of times) | top-most input's style |
| **Expand** | — | turns a selected `compound` into a plain `path` node (nested compounds expand recursively) | unchanged |
| **Divide** | immediate | split the plane into all non-overlapping faces. Iterate back→front keeping `regions[]` with styles: for each new `S`: `r ∩ S` (style of `S`), `r − S` (style of `r`), `S − ∪regions` (style `S`); drop empties; split compound results into one path per connected face; output **grouped** | each face keeps the fill/stroke of the front-most shape covering it |
| **Trim** | immediate | front→back: `visible_i = S_i − ∪(S_j, j in front)`; strokes removed, no merging | fill only (own fill) |
| **Merge** | immediate | like Trim, then unite all touching/overlapping faces that have **identical fill** (hex+alpha) | fill only |
| **Crop** | immediate | top-most shape is the crop: `S_i ∩ crop` for every other shape; crop shape disappears | fill only (own fill) |
| **Outline** | immediate | Divide, then each face → stroke-only open/closed outline: `fill:null`, `stroke = {paint: face fill, width: 1 px}` | stroke-only |
| **Minus Back** | immediate | `Sn − (S1 ∪ … ∪ S(n−1))` | front-most input's style |
*Alt/Option-click* (desktop) or the "Expanded" toggle in the touch panel applies a Shape Mode **already expanded** (no live compound). Live compounds: renderer/hit-test compute geometry lazily and cache by `(id, structural hash of children geometry + op)`; double-click enters isolation to edit children; leaving recomputes. Compound `style` is its own (copied from the table above at creation) and can be changed freely.
**Safeguards:** total segments ≤ 20 000 (else toast "Too complex to combine"); wrap every call in `try/catch` → doc unchanged + localised error toast; time budget warning at > 400 ms (show the busy overlay `pe-busy` style); degenerate results (area < 0.01 px²) dropped; open-path inputs to Intersect/Subtract are closed first.
**Tests (node:test, fixtures with two overlapping squares + circle):** areas for each operator (`area(A∪B)=A+B−I` etc.), Divide face count = 3, Trim keeps fills only, Merge merges equal fills, Crop removes the crop, Outline yields strokes only, Minus Back/Front mirror each other, compound expand equals the immediate result, z-index placement, history single-step.

### 7.7 Text engine (`engine/text.js`)
* `layoutText(node, measure) → { lines:[{ text, x, y, w, dir }], w, h, baseline }` — pure; `measure(str, fontSpec)` is injected (canvas 2D in the browser, a fixed-advance fake in unit tests).
* **Segmentation:** paragraphs split on `\n`; words via `Intl.Segmenter(locale,{granularity:"word"})` (regex fallback); over-long words broken by grapheme. Greedy wrap to `node.w` (area text) or no wrap (point text: `autoW`). `autoH` grows the box height to `lines × size × lineHeight`.
* **Bidi / script:** base direction `auto` = first strong character (Arabic/Hebrew ranges `֐-ࣿיִ-ﻼ`). `align:"start"` means **right edge for RTL lines**. Each line is emitted as one SVG `<text>` with explicit attributes `direction`, `unicode-bidi="isolate"`, `text-anchor` (`start|middle|end` chosen from the resolved alignment) and `xml:space="preserve"`; browser shaping handles Arabic joining. **Letter-spacing is forced to 0 for Arabic text** (UI disables the slider with hint `freeEditor.text.noTrackingArabic`). Justify = Latin only (distribute spaces); Arabic justify falls back to start (kashida = P2).
* **Fonts:** `ensureFontsLoaded(doc)` → for each used `(family, weight, italic)` call `document.fonts.load(spec, sampleText)`; layout is recomputed on `document.fonts` `loadingdone`. Fonts offered = shared `FONT_GROUPS` (`ensureEditorFonts()` already adds the Google `<link>`s). Fallback stack appended per family (`FONT_GROUPS` values already end with a generic family).
* **Effects:** outline = `stroke` + `paint-order="stroke"`; shadow = `<filter><feDropShadow/></filter>`; highlight = `<rect>` per line behind the text using measured widths; `caseT` applied to the *string* before layout (skip for Arabic); `numerals:"arabic"` maps digits 0-9 → ٠-٩.
* **Editing:** desktop = in-place overlay `<textarea>` styled with identical font/size/line-height/letter-spacing/`direction`/`text-align`/width (scaled with the canvas transform), the node's own text is hidden while editing, commit on blur / Ctrl+Enter / Esc (Esc keeps text, like the PPTX editor); compact = `MobileTextScreen`. **Wrap parity test:** Latin + Arabic paragraphs must wrap identically between the overlay and `layoutText` for common cases — verify in e2e; if a mismatch remains, the overlay shows the browser wrap and the committed render re-wraps (acceptable, documented).
* **Auto-fit (P1):** binary-search font size so text fits the box (same idea as `pptxEditor/textFit.js`; read it for the approach, do not import).

### 7.8 Import (`engine/importImage.js`, `importSvg.js`, `importProject.js`, `assets.js`)
* **Images:** accept PNG/JPEG/WebP/GIF (first frame) ≤ 50 MB; sniff magic bytes (not just extension/MIME). Decode with `createImageBitmap(file,{imageOrientation:"from-image"})` (fallback `<img>`), **down-scale to ≤ 4096 px longest side** (stepwise halving, `imageSmoothingQuality:"high"`), keep PNG (or WebP) if alpha else JPEG q 0.92. `assetId = sha1(first 64 KB + size + dims)` (dedupe). Blob stored in IndexedDB `assets`; an in-memory `assetUrls` map (object URLs, revoked on editor close) feeds the renderer via a `useAssetUrls(doc)` hook (analogue of `pptxEditor/useMediaUrls.js`). Corrupt/huge → typed error codes (`IMAGE_TOO_LARGE`, `IMAGE_DECODE_FAILED`, `IMAGE_UNSUPPORTED`).
* **SVG:** `importSvgText(text, {targetW}) → { nodes, warnings, fidelity, fallbackAsset }`.
  1. **Sanitise** with the same rules as `svgEditor/svgDocument.js` (remove `script, foreignObject, iframe, object, embed, audio, video`, all `on*` attributes, `javascript:` URLs, external `href`/`url()` except `data:` images, `@import`), cap 5 000 elements / 15 MB.
  2. **Resolve styles:** mount the sanitised SVG in an off-screen hidden container and read `getComputedStyle` for each shape (fill, stroke, opacity, widths, dashes, caps, joins, fill-rule, font) so class-based exports (Illustrator/Inkscape/Figma) import correctly.
  3. **Convert:** `svg/viewBox` → scale to `targetW`; `g` → `group`; `rect/circle/ellipse` → native nodes; `line/polyline/polygon/path` → `path` (`parsePathD`); `text/tspan` (single-line) → `text`; `image` (data URI) → `image` + asset; gradients → `Paint` (units + `gradientTransform` baked approximately); `use`/`symbol` → inlined clones; transforms baked (translate/scale/rotate into node fields; skew/matrix with shear → baked into path points).
  4. **Not editable → warnings:** `mask`, `filter`, `pattern`, `clipPath` (complex), markers, `textPath`, SMIL animation. If any critical feature is dropped the UI offers **"Editable (some effects dropped)"** vs **"Place as picture (exact look)"** — the latter stores the sanitised SVG as an `svg` asset and renders it with `<image href="data:image/svg+xml…">` (scalable, exportable, not editable).
* **Project file `.fdesign`:** a ZIP (`JSZip`, already a dependency): `document.json` (+ `v`), `assets/<id>.<ext>`, `preview.jpg`. `importProject` validates (`validateDocument`), migrates, restores assets into IndexedDB. Plain `.json` documents without assets are accepted (assets become empty frames + warning).
* **Drag & drop / paste / picker** funnel into one `ingestFiles(files, {target})` that routes by type and applies: image → new image node (centre, fit ≤ 60 % of page), or fills the frame under the cursor / the selected empty frame; SVG → import flow; `.fdesign` → "Replace current design?" confirm.

### 7.9 Rendering & export pipeline (one scene description, two backends)
* **`engine/vnode.js`** `sceneToVNodes(page, ctx) → VNode[]` where `VNode = { tag, attrs, children?, text? }`. `ctx` = `{ theme, assetUrls, mode:"edit"|"export", idPrefix, liveOverrides, hidePlaceholders, outline }`. Memoised per node via `WeakMap<node, {key, vnode}>` so unchanged nodes cost nothing. Two renderers consume it: `toReact(vnode)` (screen) and `toString(vnode)` (`svgOut.js`, export/thumbnail/SVG file). **Therefore screen and export can never diverge.** Defs (gradients, filters, clip paths, patterns) use ids `${idPrefix}-${nodeId}-…` — `idPrefix` is mandatory because the canvas, page strip, layers thumbnails and export would otherwise collide (this exact bug is documented in `SvgLayersPanel.jsx` `scopeMarkupIds`).
* **Export mode** differences: placeholders removed, hidden nodes skipped, images as data URLs, fonts embedded (below), page clip (`clipPath` of page rect, optionally extended by bleed).
* **Fonts for export (`engine/fonts.js`):** `collectUsedFonts(doc, theme)` → `{family, weight, italic, chars}`; for web fonts fetch the Google Fonts CSS for exactly those glyphs (CSS API `https://fonts.googleapis.com/css2?family=<Family>:wght@<w>&text=<unique chars>`; **verify at implementation time that `text=` is honoured by css2; if not, fetch the CSS and keep only the `@font-face` blocks whose `unicode-range` covers the used chars**), download the woff2, base64 it and emit `@font-face` inside the SVG `<defs><style>`. System fonts (Arial, Georgia, …) are not embedded. Cache in memory + IndexedDB `fonts`. Failure → continue with the fallback stack and add `FONT_FALLBACK` to the report (never block export).
* **Raster (`engine/raster.js`)** `rasterizePage(doc, pageId, { scale, format, quality, band=4096, bleed, signal, onProgress }) → AsyncGenerator<{ y, h, blob }>`: serialise the export SVG once; for each band build an `<svg>` with `viewBox` cropped to the band, load as `Image` (`await img.decode()`), draw into a canvas `(W·scale) × (bandH·scale)`, `toBlob`. Max band area 8 M px (iOS-safe); canvases are released (`width=0`) after each band. **Safari/WebKit data-URI font quirk:** draw once to warm the font cache, then draw again; run a 1×1 warm-up render before the first band. Check `scale` bounds: `dpi/96` with `dpi ∈ {96,150,300}` and a hard cap on total pixels (default 120 M px; above → auto-lower dpi + `DPI_REDUCED` report entry).
* **PDF (`engine/exportPdf.js`)** — follows the in-repo pattern of `brandProfilePdf.js` (`hotfixes:["px_scaling"]`, unit `"px"`, `compress:true`, `setProperties`, validate `blob.size`): `new jsPDF({ orientation, unit:"px", format:[W,H], compress:true, hotfixes:["px_scaling"] })` (W,H = page px; **+ 2×bleed when "Include bleed"**), `addPage([W,H], orientation)` per further page; for each band `doc.addImage(uint8Array, "JPEG"|"PNG", 0, y, W, h + 0.5 /*overlap, avoids hairline seams*/, undefined, "FAST")`. Default JPEG q 0.92 (PNG when the page has no photos and < 4 M px). Metadata title/author/creator (`EYAD AI`). Progress callback `(page, pages, band, bands)` and `AbortSignal` cancel. Output goes through `saveBytes(bytes, name, "application/pdf")` (native share sheet / Web Share / download). *Known limitation (shown in the Export dialog):* **text is rasterised** to guarantee correct Arabic shaping and font fidelity; vector PDF with selectable text is a P2 ("Vector PDF (beta)") evaluated with `svg2pdf.js` once Arabic shaping is proven.
* **PNG/JPG:** single `rasterizePage` call with `band` = full height when it fits, else bands stitched into one canvas via `OffscreenCanvas` (or refuse > 100 M px with advice). Transparent PNG = no page background. **SVG:** `svgOut` string (fonts embedded toggle), images as data URIs. **Project:** `.fdesign` ZIP.
* **Thumbnails:** `renderThumb(page, width)` → 200–400 px PNG data URL (used for drafts, projects, template cards generated by the content script).

### 7.10 Canvas component & interaction machine (`canvas/Canvas.jsx`)
Port the architecture of `pptxEditor/Canvas.jsx` (read it fully first): `stageRef`, `size` via ResizeObserver, `view {zoom, pan}`, `fit = min((stageW−2·PAD)/pageW, (stageH−2·PAD)/pageH)` (PAD 32 desktop / 10 compact; + ruler thickness when shown; bleed included in the fit box), `s = fit·zoom`, `pointers` Map, `gesture` ref (`idle | press | handle | pan | pinch | marquee | draw | guide | crop | nodeedit`), `R.current` "fresh refs" object, `draftRef` + `pushDraft` rAF coalescing, non-passive wheel/gesture listeners (Ctrl/⌘+wheel zoom, iOS `gesture*` blocked), double-tap/-click zoom, `clampPan`, `zoomAt`, `selectBehind`, `fit()/zoomBy()` exposed through `forwardRef` (same imperative API names as the PPTX canvas so the host code reads familiarly).
* **Tool plugins:** `tools/index.js` exports `{ id, cursor, onPointerDown, onPointerMove, onPointerUp, onKeyDown, overlay }` per tool; `Canvas` only dispatches. Adding a tool never edits `Canvas`.
* **Hit-test order:** overlay handles → rulers/guides → selected-node body → top-most node by z (reverse), honouring isolation, hidden/locked, mask/frames; `hitTestNode` from §7.3.
* **Screen↔page transform** is the single source of truth (`pageToScreen / screenToPage`), also used by overlays and by the in-place text editor.
* **Cursors:** per tool + per state (`move`, `nwse-resize` rotated by the selection's rotation, custom pen/+/−/continue cursors as inline SVG data URLs).

### 7.11 Performance, limits & resilience
Soft limits: 2 000 nodes/page (warning toast), 50 pages, 10 000 px per side, images ≤ 4096 px working copy. Rendering: memoised vnodes; **dragging moves live nodes with a CSS transform on a wrapper `<g>` instead of re-rendering the tree**; rulers/overlays are separate layers; page-strip thumbnails render lazily with `IntersectionObserver` (copy `useInView` from `Sheets.jsx`) and debounce 300 ms after edits; text layout cached by `(node, fonts-loaded-epoch)`. Boolean ops run on the main thread (Worker = P2). Autosave debounce 1.5 s. All long operations (import, export, boolean, template load) show the `pe-busy` overlay and are **cancelable** where possible.
**Resilience:** editor wrapped in an error boundary (load failure → retry; runtime render error → "Restore from draft" dialog); draft write failures never throw; every service call has a typed error with a localised message; guard against `NaN` geometry (clamp in ops) so one bad value can never blank the canvas (the PPTX suite has a *render-loop guard* test — mirror it).

### 7.12 Security
Scene is rendered from VNodes (no `dangerouslySetInnerHTML`, unlike the SVG editor); user text is always a text child; SVG import is sanitised (§7.8); project/JSON import validated + capped; file sniffing; remote requests limited to Supabase Storage (templates/projects) and Google Fonts CSS/woff2 (export-time); no `eval`/`Function`; `rel="noopener noreferrer"` on any external link; Capacitor file writes only via the existing `saveBytes`.

---

## 8. CONTENT, DATA & BACKEND

### 8.1 Strategy: **bundled-first**, remote-optional
* **v1 content is static and ships with the app** (works offline, in the Capacitor Android/iOS builds, and in guest mode; no DB dependency to demo the studio). A build script generates JSON + SVG thumbnails into `public/free-design/` (§8.4). `freeDesignContentService.js` reads `public/free-design/index.json` first.
* **Remote catalogue (P1):** the same JSON can also live in Supabase Storage + 3 small tables so marketing can add templates without a release. The service merges remote rows over the bundled index (remote wins on equal `slug`). Everything below marked *(P1)* is optional for the first release.
* **Saving the user's own designs (P0 when "Save" ships, Phase 6)** needs one table + two buckets. Pattern = `presentation_versions` + `savePresentationVersion` in `services/presentationService.js` (read it), **but** files go straight to Storage under RLS (no Edge Function needed because the path is prefixed by the user id).

### 8.2 SQL — DRAFT (`supabase/migrations/<timestamp>_free_design_studio.sql`)
> ⚠ The existing migrations (`20261110120000_presentation_templates.sql`, `20261112120000_presentation_projects_versions.sql`) were **not visible** to the planner. Before running, align naming, RLS style and `projects` column types with them (§15 asks for them). `projects.owner_id` and `projects.id` are confirmed from `services/projectService.js`; the id type is assumed `uuid`.
```sql
-- ===== A. Remote catalogue (P1, optional) =====
create table if not exists public.free_design_categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('template','background')),
  slug text not null,
  name_en text not null,
  name_ar text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (kind, slug)
);
create table if not exists public.free_design_templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.free_design_categories(id) on delete set null,
  slug text not null unique,
  title_en text not null, title_ar text not null,
  tags text[] not null default '{}',
  width_px int not null check (width_px between 1 and 10000),
  height_px int not null check (height_px between 1 and 10000),
  page_count int not null default 1 check (page_count between 1 and 50),
  accent_colors text[] not null default '{}',
  thumbnail_path text not null,           -- relative to bucket free-design-content
  doc_path text not null,                 -- FdDocument JSON, relative to the same bucket
  schema_v int not null default 1,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.free_design_backgrounds (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.free_design_categories(id) on delete set null,
  slug text not null unique,
  title_en text not null, title_ar text not null,
  tags text[] not null default '{}',
  mode text not null default 'cover' check (mode in ('cover','stretch','tile')),
  thumbnail_path text not null, doc_path text not null,
  sort_order int not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.free_design_categories  enable row level security;
alter table public.free_design_templates   enable row level security;
alter table public.free_design_backgrounds enable row level security;
create policy "fd categories public read"  on public.free_design_categories  for select using (is_active);
create policy "fd templates public read"   on public.free_design_templates   for select using (is_active);
create policy "fd backgrounds public read" on public.free_design_backgrounds for select using (is_active);
-- writes: service role only (no insert/update/delete policies on purpose).
insert into storage.buckets (id, name, public) values ('free-design-content', 'free-design-content', true)
  on conflict (id) do nothing;                    -- public read, service-role write

-- ===== B. User designs (P0 with the Save feature) =====
create table if not exists public.free_design_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  version_no int not null,
  source text not null default 'editor' check (source in ('editor','template','import','handoff')),
  label text,
  file_name text not null,
  file_path text not null,                  -- bucket free-design-files: <owner_id>/<project_id>/<id>.fdesign
  size_bytes bigint not null check (size_bytes between 1 and 104857600),
  page_count int not null default 1,
  width_px int, height_px int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, version_no)
);
create index if not exists free_design_versions_project_idx on public.free_design_versions (project_id, version_no desc);
alter table public.free_design_versions enable row level security;
create policy "fd versions owner select" on public.free_design_versions for select using (owner_id = auth.uid());
create policy "fd versions owner insert" on public.free_design_versions for insert
  with check (owner_id = auth.uid() and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy "fd versions owner update" on public.free_design_versions for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "fd versions owner delete" on public.free_design_versions for delete using (owner_id = auth.uid());

-- version_no is assigned by the DB so two tabs cannot collide
create or replace function public.free_design_assign_version() returns trigger language plpgsql as $$
begin
  if new.version_no is null or new.version_no = 0 then
    select coalesce(max(version_no), 0) + 1 into new.version_no from public.free_design_versions where project_id = new.project_id;
  end if;
  return new;
end $$;
drop trigger if exists free_design_assign_version on public.free_design_versions;
create trigger free_design_assign_version before insert on public.free_design_versions
  for each row execute function public.free_design_assign_version();
-- (the client inserts version_no = 0 and reads the row back; retry once on unique_violation)

insert into storage.buckets (id, name, public) values ('free-design-files', 'free-design-files', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('free-design-thumbs', 'free-design-thumbs', true)  on conflict (id) do nothing;
create policy "fd files owner rw"  on storage.objects for all
  using (bucket_id = 'free-design-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'free-design-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fd thumbs owner write" on storage.objects for insert
  with check (bucket_id = 'free-design-thumbs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fd thumbs owner update" on storage.objects for update
  using (bucket_id = 'free-design-thumbs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fd thumbs public read" on storage.objects for select using (bucket_id = 'free-design-thumbs');
```
**Why a public thumbs bucket?** `StudiosDesktop`/`ProjectRow` render `project_data.latest_asset_url` directly as an `<img>`; a signed URL would expire. Thumbnails are small (≤ 60 KB JPEG, 480 px) with unguessable uuid paths. The `.fdesign` file itself stays private.

### 8.3 `services/freeDesignService.js` (contract)
```js
saveFreeDesignVersion({ projectId|null, mode:"new"|"replace", replaceVersionId, name, bytes /*Uint8Array .fdesign*/, thumbBlob, meta:{pages,w,h} })
  → { projectId, version:{id,version_no,...} }      // creates the project when projectId is null:
       // projectService.create({ title:name, studio_type:"free-design", project_data:{ last_studio_id:"free-design" } })
       // uploads <uid>/<projectId>/<versionId>.fdesign (cap 100 MB, checks PK zip magic), uploads thumb → public URL,
       // projectService.update(projectId,{ project_data:{ ...pd, last_studio_id:"free-design", latest_asset_url: thumbUrl,
       //                                                  free_design:{ latest_version_id, pages, w, h, updated_at } } })
listFreeDesignVersions(projectId) · fetchFreeDesignFile(projectId, versionId=null) → { bytes, name }   // latest when null
listMyFreeDesigns(limit)        // projectService.list filtered on studio_type === "free-design" (+ latest_asset_url thumb)
deleteFreeDesignVersion(id)
```
Errors are typed `FreeDesignError(code, {retryable, detail})` with codes `AUTH_LOGIN_REQUIRED, ACCOUNT_REQUIRED, INVALID_SESSION, FILE_TOO_LARGE, UPLOAD_FAILED, VERSIONS_LOAD_FAILED, NOT_FOUND` — **reuse the exact login-error set `LOGIN_ERROR_CODES` handling of the PPTX dialog** (show the login dialog, stash the draft, `sessionStorage.eyad_fd_resume`, come back and reopen — same flow as `eyad_pptx_resume`).

### 8.4 Template & background content (what to build, how, quality bar)
**Authoring model.** Templates are written as **JS builders** with a tiny DSL in `studios/freeDesign/templates/helpers.js` (`doc()`, `page()`, `text()`, `rect()`, `ellipse()`, `path()`, `frame()` image-placeholder, `group()`, `roleFill('primary')`, `grid(cols,rows,gap)`, `stack()`), so every template is ~40–120 readable lines, uses **colour roles + font roles only** (never hard-coded colours except neutral white/black), and declares **AR + EN copy** per text node. `scripts/build-free-design-content.mjs` (node, no DOM — `engine/vnode.js` and `engine/svgOut.js` are pure) runs all builders → writes `public/free-design/templates/<slug>.json`, `thumbs/<slug>.svg` (thumbnail rendered with the fallback font stack), and `public/free-design/index.json` (`{v:1, categories, templates:[{slug,cat,title:{en,ar},tags,w,h,pages,accent[],thumb,doc,lang:["ar","en"]}], backgrounds:[…]}`), plus an optional `free_design_samples.sql` for the remote catalogue.
**All artwork must be original** (generated by code: blobs, arches, florals, balloons, stars, clouds, confetti, arabesque tiles…). No stock photos, no third-party clip-art, no licensed fonts beyond the Google families already used by the editors, **no copyrighted characters**. Photo spots are `placeholder` frames, not images.

**Template catalogue — v1 target 60 (minimum shippable 24 = the 4 bold rows)**
| Category (slug) | Count | Contents (each in AR + EN; sizes in px unless noted) |
|---|---|---|
| **Social Media** `social` | 12 | IG post 1080² ×4 (sale, quote, announcement, product) · IG story 1080×1920 ×3 (story-sale, story-quote, story-event) · IG portrait 1080×1350 ×1 · FB cover 820×312 ×1 · YouTube thumbnail 1280×720 ×2 · LinkedIn post 1200×627 ×1 |
| **Business Cards** `business-card` | 6 | 90×50 mm, **2 pages (front/back)**, 3 mm bleed; minimal, dark-luxury, monogram, split, geometric, arabesque |
| **Newborn & Baby** `newborn` (ثيمات المواليد) | 10 | Birth announcement card 5×7 in ×3 (boho arch / moon & stars / balloons) · same announcement as IG post ×1 and story ×1 · Baby shower invitation 5×7 in ×2 · Gender reveal ×1 · Monthly milestone card ×1 · Aqiqah / welcome-baby invitation ×1 (bilingual, Arabic calligraphy-friendly layout) |
| **Birthdays** `birthday` | 6 | Kids' invitation 5×7 in ×2 · 1st birthday IG post ×1 · Adult birthday invitation ×1 · Birthday greeting story ×1 · "Happy birthday" A5 card ×1 |
| **Flyers** `flyer` | 6 | A5 portrait ×6 (sale, event, restaurant opening, real estate, fitness, course) |
| **Brochures** `brochure` | 4 | Tri-fold A4 landscape (2 pages: outside/inside) ×2 · Bi-fold A4 landscape ×1 · Single-page A4 company brochure ×1 |
| **Invitations** `invitation` | 4 | Wedding ×1 · Engagement ×1 · Graduation ×1 · Eid / Ramadan iftar invitation ×1 (5×7 in) |
| **Posters** `poster` | 3 | A3 event ×1 · 50×70 cm minimal typographic ×1 · A4 announcement ×1 |
| **Menus** `menu` | 3 | A4 restaurant ×1 · DL cafe ×1 · A4 two-column bilingual ×1 |
| **Certificates** `certificate` | 2 | A4 landscape ×2 (achievement, appreciation) |
| **Seasonal** `seasonal` | 4 | Ramadan Kareem ×1 · Eid Mubarak ×1 · Egypt National/Independence-style greeting (generic "Our Nation" wording, no flags/emblems) ×1 · Mother's Day ×1 |
*Total 12+6+10+6+6+4+4+3+3+2+4 = **60**.* The bold minimum-24 order if time is short: 6 social, 4 business cards, 6 newborn, 4 flyers, 2 brochures, 2 birthdays.
**Template acceptance checklist (script-enforced in CI):** `validateDocument` passes · renders with **0 warnings** · every text node has `ar` and `en` copy (or declares single-language) · **text/background contrast ≥ 4.5:1 for all 20 palettes** in `presentationPalettes.js` when re-themed (script iterates palettes → resolves roles → contrast) · all content inside the page safe margin (≥ 4 % of the short side, 3 mm for print) · no node outside the page except intentional bleed art · ≤ 150 nodes/page · fonts only from `FONT_GROUPS` · placeholders named (`freeEditor.ph.photo`, `freeEditor.ph.logo`) · Arabic copy proof-read by a native speaker (Egyptian-friendly Modern Standard; no machine-style phrasing) · thumbnail generated.

**Backgrounds — v1 target 72 (min 36), 10 categories** (`studios/freeDesign/backgrounds/*.js`, each a builder returning `{ mode, nodes }` on a **1000 × 1000 design box**): Gradients ×8 (linear/radial/mesh-like stacked radials) · Abstract ×8 (organic blobs, waves, liquid) · Geometric ×8 (triangles, circles, grids, memphis) · Patterns ×8 (dots, stripes, chevrons, waves, scales — `tile` mode with `tileSize`) · Floral ×6 · Festive ×6 (confetti, balloons, Ramadan lanterns/crescents, fireworks) · Pastel & Baby ×8 (clouds, stars, rainbows, boho arches, moon) · Dark / Neon ×6 · Arabesque / Islamic geometry ×8 (8-/12-fold star tiles generated procedurally, `tile`) · Paper & texture ×6 (grain via `feTurbulence`, watercolor wash, kraft). All use roles so they follow the page palette. **Apply modes:** `stretch` (gradients: scaled non-uniformly), `cover` (artwork: uniform scale = max(W,H)/1000, centred, clipped), `tile` (patterns: tile size in px, offset slider in Properties). Backgrounds are **vector** → crisp at 300 dpi.

### 8.5 Brand integration (EYAD-native)
`getBrandIdentity(projectId)` (`services/brandService.js`) provides logo (url + svg when available), 4-colour palette, Arabic/English font names, background. Adapter `engine/theme.js#brandToTheme(identity)` maps: palette[0]→`bg`, [1]→`primary`, [2]→`accent1`, [3]→`accent2`, `ink` = auto (dark/light by luminance of bg); fonts → `theme.fonts.heading/body` per language (only if the family is inside `FONT_GROUPS`, else nearest + warning). *Brand tab* only appears when `?project=` resolves to a project with an approved identity; otherwise it shows the soft `EmptyCard` ("Create your identity in the Visual Identity Studio" + link).

### 8.6 Designed-for (not v1): AI hooks
Backgrounds tab "Generate with AI" → hands off to **AI Images Studio** (`/studios/ai-images?project=…&intent=background&size=WxH`) and returns the asset through the existing `current_handoff` contract (`setStudioHandoff`) as a full-bleed image fill. Text tab "Suggest copy" → EYAD chat engine (`eyadEngineService`) for headline/body suggestions in AR/EN. Both are hidden behind a feature flag in `app.config.js` (`freeDesign.ai`), default off.

---

## 9. INTEGRATION — EXACT CHANGES TO EXISTING FILES

*(Only these existing files may be edited; each edit is small and additive. Nothing under `components/pptxEditor/` or `components/svgEditor/` is touched.)*

| # | File | Change |
|---|---|---|
| 1 | `studios/studioRegistry.js` | Insert after the `templates` entry: `{ id:"free-design", name:{en:"Free Design Studio", ar:"ستوديو التصميم الحر"}, description:{en:"Design anything at any size — flyers, brochures, social posts, cards — and export PDF.", ar:"صمّم أي شيء بأي مقاس — فلايرات وبروشورات وسوشيال ميديا وكروت — ثم نزّله PDF."}, icon:"PenTool", accent:"#e11d48", status:"active", route:"/studios/free-design" }`. **Aliases** to add to `STUDIO_ALIASES`: `"free-design-studio","free_design","freedesign","free","design","designer","canva","flyer","flyers","brochure","brochures","poster","posters","social","social-media","social_media","business-card","business-cards","card","cards","invitation","greeting"` → `"free-design"`. (`template`/`templates` keep pointing to the existing Templates studio.) Update the file-header comment ("seven" → "eight"). |
| 2 | `studios/studioIcons.js` | `import { PenTool }` from lucide-react, add to the map. |
| 3 | `App.jsx` | `import FreeDesignStudio from "@/pages/FreeDesignStudio"` and `<Route path="/studios/free-design" element={<FreeDesignStudio />} />` **above** `/studios/:id`. |
| 4 | `components/intro/IntroTile.jsx` ⚠ | **Required** (verified): replace `const CARD_COUNT = 7` with `import { studioRegistry } …; const CARD_COUNT = studioRegistry.length;` and make `Y_OFFSETS`/`ARC_OFFSETS` data-driven: `Y_OFFSETS = Array(CARD_COUNT).fill(0)`; `ARC_OFFSETS` extended to 8 values (e.g. `[-28, 22, -18, 14, -14, 18, -22, 16]` — keep the first 7 untouched, the lookups use `(… [index] || 0)` so a missing value would silently flatten the 8th card; extend explicitly). Then visually verify the 3-D ring (radius `RADIUS_X/Z` may need +6 % for 8 cards) and `pages/Intro.jsx` snapping (`ANGLE_PER_CARD = 45°`). Also check `components/intro/intro.css` for hard-coded 7-card assumptions (`grep -n "7" intro.css`). |
| 5 | `components/home/HomeStudios.jsx` | Add `"free-design"` to `HOME_STUDIO_IDS` (after `"templates"`) and an entry to `STUDIO_VISUALS`: `{ image:"/images/studios/free-design.svg", title:"home.studio.free.title", line:"home.studio.free.line" }`. **Asset:** author `public/images/studios/free-design.svg` (original illustration: artboard with pen-tool nodes, shapes, ruler ticks, in the same soft pastel style as `templates.jpeg`; 1200×800). |
| 6 | `pages/Studios.jsx` | `const studioIds = Array.from(new Set([...HOME_STUDIO_IDS, "templates"]));` (fixes the existing duplicate `templates` card and includes the new studio). |
| 7 | `pages/StudiosDesktop.jsx` | `PASTEL["free-design"] = "#FFE4E6"`; add the `STUDIO_VISUALS`-style image entry used around line 47–53 (`"free-design": { image: "/images/studios/free-design.svg" }` — read the local structure first). |
| 8 | `components/home/DesktopHomeContent.jsx` | `PASTEL["free-design"] = "#FFE4E6"`; if it has an image map, add the same svg. |
| 9 | `pages/Search.jsx` | `studioIconMap["free-design"] = PenTool`; `studioAccent["free-design"] = "#e11d48"`. |
| 10 | `components/studios/StudioNextActions.jsx` | `ICONS["free-design"] = PenTool`. |
| 11 | `services/projectContextService.js` | `STUDIO_NEXT_ACTIONS["free-design"] = ["templates","presentations","brand-kit"]`; append `"free-design"` to the lists of `logo`, `brand-kit`, `templates`, `ai-images`. |
| 12 | `core/eyadCore.js` | Add route **before** the `ai-images` rule (first match wins): `{ studio:"free-design", patterns:[/(flyers?|brochures?|posters?|business ?cards?|social ?media (post|design)|instagram (post|story)|greeting card|invitation|فلاير|فلايرات|بروشور|بروشورات|بوستر|بوسترات|بزنس ?كارد|كارت (شخصي|دعوة)|دعوة|تصميم حر|تصميم (سوشيال|منشور|إعلان)|ثيم (مولود|مواليد)|مولود)/i] }`. Keep it **after** `logo`, `brand-kit` and `presentations` so "logo flyer"/"presentation poster" still behave as today. |
| 13 | `core/creativeActionRegistry.js` | Add `{ id:"free_design", label: ar?"تعديل في التصميم الحر":"Edit in Free Design", icon:"PenTool", kind:"route", studioId:"free-design" }` (after `ai_images`). Icons are resolved in `pages/Chat.jsx` (~line 1913) through the `actionIcons[action.icon] || Wand2` map — add `PenTool` to that map (import from lucide-react) or the button silently falls back to the wand icon. |
| 14 | `components/ProjectRow.jsx` | Add a thumbnail branch for `project.studioType === "free-design"` using `project.data?.latest_asset_url` (same style as the `video` branch). **Note (verified):** project rows link to `/chat?project=<id>` — not to a studio — so a saved design is reopened from the chat's creative actions (item 13) or from the studio's own **My designs** section (§4.1.5), which links to `/studios/free-design?project=<id>`. `pages/Projects.jsx` already resolves the studio via `getStudioById(project.studioType)`. |
| 15 | `i18n/translations.js` | Append the keys of §10 (EN block and AR block). Also `home.studio.free.*`. Do not reorder existing keys. |
| 16 | `pages/TemplatesStudio.jsx` (P1, one line) | In its header add a small pill link "Edit in Free Design Studio" → `/studios/free-design?tab=templates` so users who want to *edit* find the editable library. Skip if the file is hard to touch safely. |
| 17 | `components/editorKit/index.js` + `editorKit.css` | **Append-only** additions of §6.4 (`GradientEditor`, `ToolFlyout`). |
**Not in `src/` (flag to the user, §15):** `package.json` (add `paper`), `vite.config.js` (nothing required if the dynamic import works; add `optimizeDeps.include:["paper/dist/paper-core"]` if the dev server complains), `public/free-design/**` (generated), `public/images/studios/free-design.svg`, `supabase/migrations/…`, and the **chat router** in `supabase/functions/eyad-engine/index.ts` (the LLM that returns a studio id must be told that `free-design` exists; the aliases in item 1 make a loose answer safe, but without the router update the chat will never *choose* this studio on its own — the client-side regex in item 12 only covers the local fallback).

### 9.1 Landing page ⇄ editor contract
```
FreeDesignStudio.jsx
  state: editorOpen, editorInit = null | { kind:"blank", size } | { kind:"template", slug } | { kind:"background", slug, size }
                                  | { kind:"handoff", assetUrl, projectId } | { kind:"project", projectId, versionId } | { kind:"start" }
  <FreeDesignEditorHost init={editorInit} onClose onSaved />  // lazy; `init.kind==="start"` = the "Test" button (Start screen with upload)
  URL params:  ?project=<id>   → load brand + resume latest version (if any)
               ?asset=<id|latest> → handoff image (same resolution logic as StudioDetail.jsx)
               ?tab=templates|backgrounds → scroll to gallery
               ?template=<slug>  → open that template immediately (deep link, used by chat)
```
Editor props: `{ onClose, init, projectId, brand, onSaved, direction }` — **no globals**; all side effects (save, brand, assets) are injected/service-based so the engine stays testable.

---

## 10. i18N — KEYS TO ADD (EN + AR, both blocks of `translations.js`)

*Rules:* two namespaces, **`freeStudio.*`** (landing page) and **`freeEditor.*`** (editor). Every key exists in both languages (a test enforces parity). Use `{n}`-style variables. Arabic uses clear Modern Standard wording with common design terms; keep English product terms (Pathfinder, Pen) in parentheses **only** where designers search for them.
| Key | EN | AR |
|---|---|---|
| `freeStudio.title` | Free Design Studio | ستوديو التصميم الحر |
| `freeStudio.tagline` | Design anything, any size — then download it as PDF. | صمّم أي شيء بأي مقاس… ثم نزّله PDF. |
| `freeStudio.testEnvironment` | Test Free Design Environment | بيئة اختبار التصميم الحر |
| `freeStudio.hero.title` | What do you want to design? | ماذا تريد أن تصمّم؟ |
| `freeStudio.custom` | Custom size | مقاس مخصص |
| `freeStudio.templates` / `.backgrounds` / `.myDesigns` | Templates / Backgrounds / My designs | القوالب / الخلفيات / تصميماتي |
| `freeStudio.resume.title` | Continue your last design | أكمل تصميمك الأخير |
| `freeStudio.cat.all/social/business-card/newborn/birthday/flyer/brochure/invitation/poster/menu/certificate/seasonal` | All / Social Media / Business Cards / Newborn & Baby / Birthdays / Flyers / Brochures / Invitations / Posters / Menus / Certificates / Seasonal | الكل / سوشيال ميديا / بطاقات الأعمال / المواليد والأطفال / أعياد الميلاد / فلايرات / بروشورات / دعوات / بوسترات / قوائم الطعام / شهادات / مواسم ومناسبات |
| `freeStudio.bgcat.gradients/abstract/geometric/patterns/floral/festive/pastel/dark/arabesque/paper` | Gradients / Abstract / Geometric / Patterns / Floral / Festive / Pastel & Baby / Dark & Neon / Arabesque / Paper & Texture | تدرجات / تجريدي / هندسي / أنماط / زهور / احتفالي / باستيل وأطفال / داكن ونيون / أرابيسك / ورق وخامات |
| `freeEditor.title` | Test Free Design Environment | بيئة اختبار التصميم الحر |
| `freeEditor.open` | Upload an image or SVG to test | ارفع صورة أو SVG للتجربة |
| `freeEditor.dropHint` | …or drop a file here (PNG, JPG, WebP, SVG, .fdesign) | …أو أفلت الملف هنا (PNG وJPG وWebP وSVG و‎.fdesign) |
| `freeEditor.start.blank/templates/upload` | Blank canvas / Templates / Upload & test | لوحة فارغة / القوالب / ارفع وجرّب |
| `freeEditor.ribbon.home/insert/draw/text/design/arrange/view/format` | Home / Insert / Draw / Text / Design / Arrange / View / Format | الرئيسية / إدراج / رسم / نص / تصميم / ترتيب / عرض / تنسيق |
| `freeEditor.tool.select/directSelect/pen/pencil/rect/ellipse/triangle/polygon/star/line/arrow/text/image/hand/zoom/eyedropper` | Select / Direct select / Pen / Pencil / Rectangle / Ellipse / Triangle / Polygon / Star / Line segment / Arrow / Text / Image / Hand / Zoom / Eyedropper | تحديد / تحديد مباشر / القلم / قلم رصاص / مستطيل / دائرة / مثلث / مضلع / نجمة / خط مستقيم / سهم / نص / صورة / يد / تكبير / قطّارة الألوان |
| `freeEditor.pf.shapeModes` / `.pathfinders` | Shape Modes / Pathfinders | أوضاع الأشكال / أدوات Pathfinder |
| `freeEditor.pf.unite/minusFront/intersect/exclude/expand` | Unite / Minus Front / Intersect / Exclude / Expand | دمج / طرح الأمامي / تقاطع / استبعاد / توسيع |
| `freeEditor.pf.divide/trim/merge/crop/outline/minusBack` | Divide / Trim / Merge / Crop / Outline / Minus Back | تقسيم / اقتطاع / تجميع المتشابه / اقتصاص / مخطط خارجي / طرح الخلفي |
| `freeEditor.pf.needTwo` | Select two or more shapes | حدّد شكلين أو أكثر |
| `freeEditor.pf.textFirst` | Convert text to shapes first | حوّل النص إلى أشكال أولًا |
| `freeEditor.view.rulers/guides/smartGuides/grid/snap/outline/pixelPreview/present/fitPage/actualSize/hideBorder/clearGuides/lockGuides` | Rulers / Guides / Smart guides / Grid / Snap / Outline mode / Pixel preview / Present / Fit page / Actual size / Hide page border / Clear guides / Lock guides | المساطر / خطوط الإرشاد / الإرشادات الذكية / الشبكة / الالتصاق / وضع الحدود / معاينة البكسل / عرض / ملاءمة الصفحة / الحجم الفعلي / إخفاء حدّ الصفحة / مسح الإرشادات / قفل الإرشادات |
| `freeEditor.size.title/width/height/unit/orientation/pages/bleed/lockRatio/create` | New design / Width / Height / Unit / Orientation / Pages / Bleed / Lock ratio / Create design | تصميم جديد / العرض / الارتفاع / الوحدة / الاتجاه / عدد الصفحات / الزيادة (Bleed) / قفل النسبة / إنشاء التصميم |
| `freeEditor.unit.px/mm/cm/in` | px / mm / cm / in | بكسل / مم / سم / بوصة |
| `freeEditor.export.title/pdf/png/jpg/svg/project/quality/screen/standard/print/includeBleed/download/preparing` | Export / PDF / PNG / JPG / SVG / Project file / Quality / Screen / Standard / Print / Include bleed / Download / Preparing page {page} of {pages}… | تصدير / PDF / PNG / JPG / SVG / ملف المشروع / الجودة / شاشة / قياسية / طباعة / تضمين الزيادة / تنزيل / جارٍ تجهيز الصفحة {page} من {pages}… |
| `freeEditor.export.rasterNote` | Text is exported as high-resolution image for perfect Arabic shaping. | يُصدَّر النص كصورة عالية الدقة لضمان شكل الحروف العربية بدقة. |
| `freeEditor.text.noTrackingArabic` | Letter spacing is disabled for Arabic so letters stay joined. | تباعد الأحرف متوقف للنص العربي حتى تبقى الحروف متصلة. |
| `freeEditor.ph.photo/logo/text` | Tap to add a photo / Add your logo / Your text here | اضغط لإضافة صورة / أضف شعارك / نصّك هنا |
| `freeEditor.errors.*` | one key per typed code (§7.8/§8.3): `IMAGE_TOO_LARGE, IMAGE_DECODE_FAILED, IMAGE_UNSUPPORTED, SVG_UNSAFE, SVG_TOO_COMPLEX, PROJECT_INVALID, PROJECT_NEWER, EXPORT_TOO_LARGE, EXPORT_FAILED, PF_TOO_COMPLEX, PF_FAILED, AUTH_LOGIN_REQUIRED, UPLOAD_FAILED, TEMPLATE_LOAD_FAILED` | friendly, actionable sentences (what happened + what to do) |
The implementer writes the remaining ~250 keys (property labels, section titles, toasts, confirms, shortcuts help, empty states) following the same pattern and **Arabic-first review**: after finishing a phase, list all new AR strings in the report for the user to proof-read.

---

## 11. DELIVERY PLAN — PHASES, FILES, DEFINITION OF DONE

*Effort is expressed in "implementer sessions" (one focused Claude session that receives `src/` and this document). Estimates are planning guesses, not commitments.* Build in this order; **never start a phase before the previous Definition of Done (DoD) is demonstrably met** (run the tests, open the editor on desktop width and on a 390 px phone viewport, in AR/RTL and EN/LTR).

### Phase 0 — Preparation (0.25 session)
* Read this document, then `components/editorKit/*`, `pptxEditor/PptxEditorDialog.jsx` (render + sheets), `pptxEditor/Canvas.jsx`, `pptxEditor/Sheets.jsx`, `pptxEditor/pptxEditor.css`, `svgEditor/SvgEditorDialog.jsx` (mobile tabs), `pages/PresentationsStudio.jsx` (lazy host + test button), `components/presentations/TemplateGallery.jsx`.
* User installs `paper` (`npm i paper@^0.12.17`) and confirms §14 answers. Create the empty folder skeleton of §7.0.
* **DoD:** skeleton committed, `npm run build` green.

### Phase 1 — Studio shell, test button, Start screen, image test-and-export (1.5 sessions) ← *first demo to the client*
Files: registration edits §9 (items 1–11, 15 partial), `pages/FreeDesignStudio.jsx` (+css, hero + category chips + **Test button**), `FreeDesignEditorHost.jsx`, `FreeDesignEditor.jsx` (shell only), `freeDesign.css` (copied/re-scoped host rules §6.3 + layout), `dialogs/Start.jsx`, `dialogs/SizeDialog.jsx`, `state/*` (minimal), `engine/{schema,ids,units,vnode,svgOut,raster,exportPdf,exportImage,importImage,assets,draftStore}.js`, `canvas/Canvas.jsx` (pan/zoom/fit/pinch/double-tap only), page strip stub, mobile tab bar with the final tab list (most disabled).
Behaviour: studio visible everywhere (intro ring fixed, §9 item 4, studios page, home); landing page; **Test button → editor Start screen → upload PNG/JPG/WebP/SVG → document sized to the image, picture placed (locked, full-bleed) → pan/zoom/fit works with mouse, wheel, pinch → Export PDF/PNG** (PDF page size = image size). Blank canvas with size dialog works. Responsive shell identical to PPTX (ribbon on desktop, bottom bar + sheets on phones; tabs present but empty states). Toasts, modals, busy overlay, close-confirm, error boundary.
**DoD:** client-demo script passes on desktop + phone; `free-design-integrity` + `free-design-units` + `free-design-export-basic` tests green; visual parity checklist §6 items verified with side-by-side screenshots of PPTX vs Free (header, tab bar, sheet, toast, wave slider).

### Phase 2 — Document engine + core editing (3 sessions)
Files: `engine/{ops,geometry,matrix,align,shapes,text,theme(roles only)}.js`, `state/{useEditorState,history,selection,clipboard,useDraft}.js`, `canvas/{SceneView,Thumb,tools/{select,shape,text,image,hand,zoom}.js, overlays/{Selection,Marquee,SmartGuides,DimTooltip}}`, `panels/{PropertiesPanel,LayersPanel,PageStrip}` + `sections/{Arrange,Size,Appearance,Shape,Text,Image,PageProps}`, ribbon tabs Home/Insert/Text/Arrange/Design(background only), mobile sheets (Layers, Arrange, Size, Colors, Text, Add, Page), `GradientEditor` kit addition, `ToolRail` + `ToolFlyout`, `MobileTextScreen`, shortcuts.
Behaviour: all shapes (rect w/ per-corner radius, ellipse, triangle, polygon, star, line/arrow, all-shapes sheet), text (Arabic/English, inline edit + mobile composer), images (place, crop, frames, filters), fill/stroke/gradient/opacity/shadow, select/multi-select/marquee/group/lock/hide/order/align/distribute/duplicate/copy/paste, undo/redo with gesture grouping, multi-page (add/duplicate/delete/reorder), draft autosave + resume, smart guides (basic snapping) .
**DoD:** an editor session designing a full flyer by hand on desktop and phone works; text wrap parity Latin+Arabic verified; render-loop guard + ops + history + text-layout tests green; **no console warnings**; 2 000-node page stays ≥ 45 fps drag (manual check).

### Phase 3 — Pen, node editing, rulers, guides, View (2.5 sessions)
Files: `engine/{path,ruler,snap}.js`, `canvas/tools/{pen,direct,pencil,eyedropper}.js`, overlays `{Rulers,UserGuides,Margins,PenPreview,NodeEdit}`, `mobile/{PenActionBar,Loupe,FloatingToolRail}`, Draw & View ribbon tabs + sheets, shortcuts for all View toggles.
**DoD:** every row of the pen state table (§7.3) demonstrated; node edit on mouse and touch; rulers correct in px/mm/cm/in (verify 210 mm A4 reads 210 at the page edge); guides created by dragging from rulers, snapped to, deleted by dragging back; outline mode; View menu items of reference image 2 present (§2.2 list); path + ruler + snap tests green.

### Phase 4 — Pathfinder, compound shapes, masks/frames, SVG import (2.5 sessions)
Files: `engine/{boolean,importSvg}.js`, `panels/PathfinderPanel.jsx` (+ Draw tab group + mobile sheet), compound node support in vnode/hit-test/layers, `makeFrame/releaseFrame`, `fdIcons` Pathfinder glyphs, SVG import warnings sheet.
**DoD:** all 10 operators + Expand verified with the fixtures of §7.6 and visually against Illustrator semantics; Alt-click expanded mode; live compound editing via isolation; import of 6 real-world SVGs (Illustrator export with classes, Inkscape, Figma, a logo from the Logo Studio, an SVG with gradients, one with masks → warning path) behaves as specified; sanitiser rejects the malicious fixtures.

### Phase 5 — Libraries: templates, backgrounds, elements, brand, language (3 sessions; content volume dominates)
Files: `studios/freeDesign/{templates,backgrounds,categories,fontPairs,shapesLibrary}/**`, `scripts/build-free-design-content.mjs`, `public/free-design/**` (generated), `services/freeDesignContentService.js`, `panels/library/*`, mobile sheets, landing gallery (categories, cards, loading/error), `engine/theme.js` (palette/brand/language), Brand tab, `IconLibraryPicker` embedding, placeholders (tap-to-fill), Language flip + mirror.
**DoD:** ≥ 24 templates (target 60) and ≥ 36 backgrounds (target 72) pass the acceptance checklist script; re-theme with all 20 palettes keeps contrast; AR⇄EN flip works; photo placeholder fill; gallery cards render real thumbnails; works offline.

### Phase 6 — Export hardening, Save, project file, My designs, handoffs (2 sessions)
Files: `engine/{fonts,exportSvg,exportProject,importProject,magicResize(P1)}.js`, `dialogs/{ExportDialog,SaveDialog,LoginDialog,ReportSheet}`, `services/freeDesignService.js`, migration §8.2, landing "My designs", handoff from AI Images/Chat (`?asset`), `StudioNextActions`, bleed + safe-zone overlays, print-readiness hints.
**DoD:** 10-page 300-dpi A4 PDF exports without memory errors on desktop and mid-range Android (≥ 120 M px guard works); Arabic text identical in PDF and on canvas; bleed PDF page size = trim + 2×bleed; PNG/JPG/SVG/.fdesign round-trip; save new/replace + guest→login→resume flow identical to PPTX; native share sheet works (Capacitor build) .

### Phase 7 — Polish, accessibility, performance, docs (1.5 sessions)
Keyboard completeness + shortcuts sheet, aria-live announcer, reduced-motion, coarse-pointer sizes, RTL audit (every screen), perf budget (editor chunk ≤ 600 KB gz excluding lazy `paper`/`jspdf`/`jszip`), e2e suites, `docs/FREE_DESIGN_STUDIO.md` (architecture, schema, how to add a tool/template/background), cleanup, final parity review with side-by-side screenshots.
**DoD:** all test suites green in CI; Lighthouse a11y ≥ 95 on the studio page; zero `console.error` in the e2e runs; docs written.

### Optional Phase 8 — Vector PDF (P2, 2 sessions)
Goal: selectable-text, tiny-file, print-shop-grade PDF. Approach: `svg2pdf.js` + jsPDF, **text converted to outlines at export** (HarfBuzz via `harfbuzzjs` or `opentype.js` + an Arabic shaper, using the same font files already embedded for raster export) so shaping stays perfect and no font licensing/embedding issue appears; images stay raster. Ship behind an "Advanced → Vector PDF (beta)" toggle after side-by-side pixel diff on 20 Arabic/English samples.

**Total (Phases 0–7): ≈ 16 sessions.** If the client needs a faster visible win, ship at the end of Phase 2 (editor usable) with templates deferred, or at Phase 3 (+pen/rulers), as internal milestones; Phase 1 alone is the "test button" demo.

### 11.1 Prompt to hand to the implementer for each phase
```
You are implementing Phase <N> of FREE_DESIGN_STUDIO_PLAN.md in the attached src/ folder (EYAD AI, React 18 + Vite).
Read §0 (rules), §6 (UI compliance) and §<relevant sections> first. Do not modify components/pptxEditor or components/svgEditor.
Work in the order of the phase's Files list; keep the app building after every step. When done: run the tests of §12 for this phase,
screenshot desktop (1440×900) and phone (390×844) in AR and EN, and report: files created/changed, deviations from the plan (with reasons),
new AR strings for proof-reading, and anything you could not verify. Do not start the next phase.
```

---

## 12. TEST & QUALITY PLAN

**Unit / reliability (node:test, in `tests/reliability/`, same style as the existing suites):**
| File | Covers |
|---|---|
| `free-design-units.test.js` | px↔mm/cm/in, formatting decimals, A4/business-card exact sizes, size clamp 1–10 000 |
| `free-design-schema.test.js` | `validateDocument` caps/enums/NaN, `migrate`, unknown-version rejection, id uniqueness |
| `free-design-ops.test.js` | add/remove/reorder/group/ungroup, group-aware `setBounds`, align/distribute, resize with rotation, paste ids, page ops, history (gesture = 1 step, 100 cap) |
| `free-design-path.test.js` | parse `d` (all commands, arcs), bbox exactness, split segment keeps curve, anchor convert, fitCurve error bound, rotated-node anchor invariance |
| `free-design-boolean.test.js` | §7.6 areas for all operators, Divide faces, Trim/Merge/Crop/Outline semantics, compound expand ≡ immediate, z placement, complexity guard |
| `free-design-snap.test.js` | targets, thresholds, speed gating, equal spacing, rotation snaps; `free-design-ruler.test.js` ticks (1-2-5 steps, inch fractions, ≥ 64 px spacing) |
| `free-design-text.test.js` | wrap with fake measure (Latin/Arabic/mixed), base direction, alignment mapping for RTL, tracking forced 0 for Arabic, numerals map |
| `free-design-vnode.test.js` | deterministic output, id-prefix uniqueness across 3 renders of the same page, export mode removes placeholders/hidden, **screen vs string renderer produce identical trees** |
| `free-design-import-svg.test.js` | sanitiser vs fixtures (`script`, `foreignObject`, `on*`, `javascript:`, external `href`, `@import`, billion-laughs style entity), class-based styles, gradients, `use`, transforms; warnings list; size caps |
| `free-design-import-image.test.js` | magic-byte sniffing, oversize, downscale math, EXIF flag handling (mock) |
| `free-design-project-file.test.js` | `.fdesign` round-trip, corrupted zip, newer schema, missing assets |
| `free-design-export-basic.test.js` | band planner (no gaps/overlap > 0.5 px), dpi→scale caps, pixel cap auto-lowering + `DPI_REDUCED`, PDF page size (incl. bleed), progress/abort |
| `free-design-content.test.js` | **every template and background**: validates, renders with 0 warnings, AR+EN copy present, node/page caps, safe margins, contrast ≥ 4.5 across the 20 palettes |
| `free-design-i18n.test.js` | every `freeStudio.*`/`freeEditor.*` key exists in EN and AR; no unused variables mismatch `{n}` |
| `free-design-editor-module-integrity.test.js` | mirror of `editor-module-integrity.test.js` (read it): the editor module and its lazy imports resolve; no import from `pptxEditor/` or `svgEditor/` (only `editorKit`, `shared`, `ui`, `lib`, `services`, `i18n`, and read-only SVG/PNG assets) |
| `free-design-render-loop-guard.test.js` | mirror of `pptx-render-loop-guard.test.js`: mounting with a large doc does not re-render > N times; NaN geometry never blanks the canvas |
| `free-design-css-scope.test.js` | every selector in `freeDesign.css` starts with `.fd-root`/`.fd-page-`/`@keyframes fd-`; no `left:`/`right:`/`margin-left` etc. outside the canvas/overlay allow-list; **no edits to protected files** (git diff guard: `pptxEditor/**`, `svgEditor/**`, existing `ek-*` rules) |

**E2E (Python Playwright, same harness as `tests/e2e/*.py`, add `harness/free.html` + `free.jsx` that mounts the editor in isolation):**
`free_design_desktop.py` (start → blank A4 → shape/text/pen/pathfinder/rulers/guides → undo/redo → export PDF → verify PDF bytes & page size) · `free_design_mobile.py` (390×844 touch: tab bar, sheets, floating rail, pen with loupe, pinch zoom, text composer) · `free_design_rtl.py` (AR UI, Arabic text edit/export, mirrored panels, canvas stays LTR) · `free_design_upload_test.py` (the **Test button** flow with PNG, JPG, SVG, malicious SVG, 30 MB image, `.fdesign`) · `free_design_template.py` (open each category's first template, edit placeholder, re-theme, flip language, export) · `free_design_save.py` (guest → login dialog → resume; new/replace versions with a fake backend like `tests/reliability/helpers/fake-backend.mjs`).
**Manual QA matrix:** Chrome / Safari iOS / Android WebView (Capacitor) / Firefox × AR/EN × desktop/phone; Arabic text samples with diacritics, mixed numerals, long words; export a 10-page A4 at 300 dpi on a mid-range phone; print one business card PDF and check bleed/crop.
**CI:** add the new suites to the existing workflow (`.github/workflows/ci.yml`, not visible — §15).
**Visual parity review (human, end of each phase):** screenshots of the same state in PPTX editor vs Free editor: header, ribbon tab, tab bar, sheet open, sliders, rotation wheel, toast, modal, layers rows, color picker. Any visible mismatch of spacing, radius, font size, hover/press motion is a bug.

---

## 13. RISKS & MITIGATIONS
| Risk | Impact | Mitigation |
|---|---|---|
| **Visual divergence from PPTX/SVG editors** (the user's strictest requirement) | Rework | §6 checklist; only kit components; copy host CSS (§6.3) instead of re-inventing; side-by-side screenshot gate each phase |
| **Arabic text correctness** (shaping, bidi, wrap, export) | Client-visible defects | Browser does shaping (SVG `<text>` + canvas); raster PDF in v1; tracking disabled for Arabic; wrap parity test; Arabic proof-reading gate; vector PDF only after pixel-diff proof (Phase 8) |
| **Memory/canvas limits on phones** (iOS ~16 M px canvas, Android lower) | Export crashes | Banded rasterisation (≤ 8 M px bands), pixel cap + auto-lower dpi, warm-up render, cancel, report entry |
| **Boolean ops robustness** (paper.js edge cases: self-intersections, tiny gaps) | Wrong/empty results | try/catch + unchanged doc, complexity cap, degenerate-drop, fixtures incl. nasty cases, adapter layer for swapping to another kernel; Pathfinder runs on flattened-clean inputs (tolerance 0.01) |
| **Editor bundle size** | Slow first open | Lazy editor chunk; dynamic import of `paper`, `jspdf`, `jszip`, fonts CSS; thumbnails as static SVG; budget test |
| **Content volume** (60 templates + 72 backgrounds with good design & Arabic copy) | Schedule | DSL + helpers + shared building blocks (headers, frames, ornaments); minimum-24 cut; checklist script; content built in Phase 5 only, in parallel by category |
| **Google Fonts dependency at export time** (offline / blocked) | Wrong fonts in PDF | Cache woff2 in IndexedDB after first load; report `FONT_FALLBACK`; system-font fallbacks designed per family; warn before export when offline |
| **Touch precision for Pen** | Poor mobile UX | Loupe + action bar + 44 px hit areas + snap + undo-point; Pencil tool as alternative |
| **Intro carousel / registry side-effects** (8th studio) | Broken landing animation | §9 item 4 fix + visual check; i18n + alias coverage |
| **Copyright of content** | Legal | All art generated in code; no stock/clip-art/characters; fonts only from the existing Google set (OFL) |
| **Schema evolution** | Broken saved designs | `v` + `migrate` + tests from day 1; unknown-newer rejected gracefully |
| **Scope creep** (Canva-sized wish list) | Delay | P0/P1/P2 tags; Phase gating; P2 list is explicit (§4.7, Phase 8) |
| **Implementer can't see package.json / SQL migrations / router function** | Mis-integration | §15 list of files to pass; plan drafts SQL and states every non-`src` change |

---

## 14. OPEN QUESTIONS (answer before Phase 1 if possible; defaults in bold are what the plan assumes)
1. **Voice note** — not transcribed in analysis. Someone should listen and confirm it adds nothing beyond the written message. *(blocking for scope, not for architecture)*
2. **"ثيمات مواليد"** = **newborn / baby / birthday themes** (§2.4). If it means something else (e.g. Hijri/zodiac birth-month themes) only the content pack changes.
3. **PDF fidelity:** is a **high-resolution image-based PDF acceptable for v1** (perfect Arabic, 300 dpi, no selectable text), with vector PDF later (Phase 8)? Or must v1 be vector? (Vector adds ~2 sessions and a shaping risk.)
4. **Print:** do clients need **CMYK / PDF-X**? (**No** — RGB PDF with bleed + crop marks later.) 
5. **Account policy:** designing and exporting **without an account** (guest-first, consistent with the app) and **account only to save to My Projects** — confirm.
6. **Limits:** max **50 pages**, **10 000 px** per side, **100 MB** project, 50 MB per image — acceptable? Any credits/paywall on export?
7. **Languages:** AR + EN only (**yes**)? Other languages' fonts (Kurdish, Persian, Urdu) are not in scope.
8. **Template authorship:** who proof-reads Arabic copy and approves designs? (**Implementer builds, client approves**; plan includes a review gate.)
9. **Marketplace:** should user designs/templates later be publishable to the (placeholder) Marketplace? (designed-for via `.fdesign`, not built.)
10. **AI inside the studio** (generate background, copy suggestions): off in v1, hooks designed (§8.6) — confirm.
11. **Team/real-time collaboration, comments, version history UI beyond save-new/replace:** out of scope.
12. **Brand kit hand-in-hand:** is *Apply my brand* in v1 (**yes, P1 inside Phase 5**) or later?

---

## 15. FILES / FOLDERS I NEED YOU TO PASS ALONGSIDE `src/` (answer to "tell me if you want additional files")
The implementer receives **only `src/`** — it cannot see the items below, and several are **required to integrate correctly**. They are small; please attach them together with `src/` (and this plan):
| Priority | Path | Why |
|---|---|---|
| **MUST** | `package.json` | add `paper`, see exact versions of React/Vite/jspdf/jszip/Radix/Tailwind, scripts (`test`, `build`), lint config |
| **MUST** | `CLAUDE.md` and `AGENTS.md` (project root) | the project's own working rules for AI assistants — they override anything generic in this plan if they conflict (they exist at the root in the tree but were not included in `src.zip`) |
| **MUST** | `docs/PPTX_EDITOR.md`, `docs/PPTX_EDITOR_DOCUMENTATION.md` | the written design rules of the PPTX editor (UI contract, interactions) — the strongest source for "match exactly" |
| **MUST** | `supabase/migrations/20261110120000_presentation_templates.sql`, `20261111120000_presentation_templates_pptx.sql`, `20261112120000_presentation_projects_versions.sql` | to align the draft SQL of §8.2 (naming, RLS style, project FK types) |
| HIGH | `tailwind.config.cjs`, `postcss.config.js`, `vite.config.js`, `jsconfig.json`, `eslint.config.js`, `index.html` | aliases (`@/`), content globs (new `fd-` classes), chunking, lint rules |
| HIGH | `tests/reliability/editor-module-integrity.test.js`, `svg-editor-workspace-bounds.test.js`, `pptx-render-loop-guard.test.js`, `presentation-editor-feature-controls.test.js`, `tests/e2e/common.py`, `mobile.py`, `run.sh`, `tests/e2e/harness/main.jsx` + `pptx.html` | to mirror test conventions and the e2e harness exactly |
| HIGH | `supabase/functions/eyad-engine/index.ts` | the chat router must be taught the new studio id (§9) |
| MEDIUM | `public/sw.js`, `.github/workflows/ci.yml`, `capacitor.config.ts`, `codemagic.yaml` | service-worker caching of `public/free-design/**`, CI test list, native file-saving behaviour |
| MEDIUM | one **screenshot of each existing editor on desktop and phone** (PPTX + SVG, with a selection and one open sheet) | the implementer cannot run the app from the zip alone; real screenshots remove all guesswork about spacing/colour/motion |
| LOW | the voice note transcript (text) | scope confirmation |
**Not needed:** `android/`, `ios/`, `node_modules/`, `dist/`, `backup-base44-legacy/`, `base44/`, `_backup_before_integration/`.
**Also needed from the user's machine (commands, not files):** `npm i paper@^0.12.17` · run the SQL migration in Supabase · create buckets via the migration · deploy the updated `eyad-engine` function · (optional) provide a 1200×800 hero image if you prefer a photo to the generated SVG for the studio tile.

---

## 16. DEFINITION OF "DONE" FOR THE WHOLE STUDIO
1. Free Design Studio appears in Intro, Home, Studios (mobile + desktop), Search and Chat routing, opens at `/studios/free-design`.
2. **Test Free Design Environment** button works like the PPTX/SVG test buttons: opens the editor, accepts an uploaded image/SVG/.fdesign, edits, exports.
3. Every client requirement R1–R11 (§2.1) demonstrably works on desktop and phone in AR and EN.
4. The editor is visually and behaviourally indistinguishable in style from the PPTX/SVG editors (§6 checklist signed off with screenshots).
5. ≥ 24 (target 60) templates and ≥ 36 (target 72) backgrounds, all editable, bilingual and re-themable.
6. PDF export is exact-size, multi-page, print-quality; Arabic renders correctly; no crashes on mid-range phones.
7. All test suites of §12 pass; no protected file modified; docs written; no `console.error` in e2e.

---

## APPENDIX A — QUICK ANSWER TO "WHAT WILL THE USER SEE?"
*Studio page:* hero "What do you want to design?" with size chips · resume card · template gallery by category (Social, Business cards, **Newborn & Baby**, Birthdays, Flyers, Brochures…) · backgrounds gallery · **[Test Free Design Environment]** pill (top-right).
*Editor (desktop):* header · ribbon (Home/Insert/Draw/Text/Design/Arrange/View) · left tool rail (Select, Direct select, **Pen**, Pencil, **Shapes flyout** with Rectangle (M)/Ellipse (L)/Polygon/Star/Line (\), Text, Image, Hand, Zoom) · library panel (Templates/Elements/Text/Media/Backgrounds) · canvas with **horizontal + vertical rulers and draggable guides** · properties (Arrange, Size, Rotation wheel, Appearance, **Pathfinder panel — Unite / Minus Front / Intersect / Exclude / Expand, Divide / Trim / Merge / Crop / Outline / Minus Back**) · layers · page strip · footer with zoom.
*Editor (phone):* same tools via bottom tab bar + animated bottom sheets + floating tool rail, pen with magnifier loupe, full-screen text composer.
*Finish:* **Export → PDF** (any size, multi-page, print quality) · PNG · JPG · SVG · project file · Save to My Projects.
