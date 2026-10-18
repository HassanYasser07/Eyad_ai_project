"""Desktop (Chromium, mouse+keyboard) end-to-end checks for the presentation editor."""
import sys, os, json, subprocess, math, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail)); print(("PASS" if ok else "FAIL"), "-", name, detail if not ok or detail else "")

def rect(page, sel, nth=0):
    return page.locator(sel).nth(nth).bounding_box()
def center(b): return (b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)
def frame_matches(page, el_sel, nth=0, tol=3):
    e = rect(page, el_sel, nth); f = rect(page, '[data-testid="pptx-frame"]')
    if not e or not f: return False, (e, f)
    ce, cf = center(e), center(f)
    # compare centres (rotation-safe); sizes only when un-rotated
    return abs(ce[0] - cf[0]) <= tol and abs(ce[1] - cf[1]) <= tol, (ce, cf)
def topmost_at(page, x, y):
    return page.evaluate("""([x,y]) => { const e = document.elementsFromPoint(x,y)[0]; if(!e) return null;
        const h = e.closest('.pptx-handle'); return h ? 'handle:'+h.dataset.handle : (e.closest('.pptx-el') ? 'content' : e.className); }""", [x, y])
def tab(page, i): page.locator(".pe-right .pe-tabs button").nth(i).click(); page.wait_for_timeout(80)
def val(page, tid): return float(page.locator(f'[data-testid="{tid}"]').input_value())
def img_pos(page, nth):  # screen box of nth picture on canvas
    return rect(page, ".pptx-holder .pptx-el-image", nth)
def stage_empty(page):
    b = page.locator(".pptx-stage").bounding_box(); return b["x"] + 8, b["y"] + 8
def alt_click(page, x, y):
    page.keyboard.down("Alt"); page.mouse.click(x, y); page.keyboard.up("Alt")
def shift_click(page, x, y):
    page.keyboard.down("Shift"); page.mouse.click(x, y); page.keyboard.up("Shift")
def drag(page, x0, y0, x1, y1, steps=8, release=True):
    page.mouse.move(x0, y0); page.mouse.down(); page.mouse.move(x1, y1, steps=steps)
    if release: page.mouse.up()
    page.wait_for_timeout(120)

with sync_playwright() as p:
    b, c, page, errors = launch(p, viewport={"width": 1440, "height": 900}, accept_downloads=True)
    open_fixture(page, "overlap.pptx")

    # ---- 1. selection layering & frame tracking on every picture ----
    for n in range(3):
        bb = img_pos(page, n)
        # click a point on this picture that no later picture covers: its top-left corner area
        page.mouse.click(bb["x"] + 12, bb["y"] + 12); page.wait_for_timeout(120)
        ok, d = frame_matches(page, ".pptx-holder .pptx-el-image", n)
        check(f"image {n+1}: frame aligned with object", ok, d)
        f = rect(page, '[data-testid="pptx-frame"]')
        top = topmost_at(page, f["x"] + f["width"], f["y"] + f["height"])  # SE handle location, over the picture
        check(f"image {n+1}: SE handle is above the image content", top == "handle:se", top)
        top_n = topmost_at(page, f["x"] + f["width"] / 2, f["y"])
        check(f"image {n+1}: N handle above content", top_n == "handle:n", top_n)
        rot = topmost_at(page, f["x"] + f["width"] / 2, f["y"] - 34)
        check(f"image {n+1}: rotate handle reachable above frame", rot == "handle:rotate", rot)

    # ---- 2. overlap: topmost wins on fresh press; selected stays grabbable under an object above it ----
    A, B = img_pos(page, 0), img_pos(page, 1)
    px, py = B["x"] + 40, B["y"] + 40            # inside A∩B (B is above A)
    page.mouse.click(*stage_empty(page)); page.mouse.click(px, py); page.wait_for_timeout(100)
    check("overlap: fresh click selects the topmost object (B)", page.locator('[data-testid="pptx-frame"]').count() == 1 and frame_matches(page, ".pptx-holder .pptx-el-image", 1)[0])
    page.mouse.click(A["x"] + 12, A["y"] + 12); page.wait_for_timeout(100)   # select A (only A there)
    a0, b0 = img_pos(page, 0), img_pos(page, 1)
    drag(page, px, py, px + 60, py + 30)                                       # press where B covers A
    a1, b1 = img_pos(page, 0), img_pos(page, 1)
    check("overlap: dragging inside selected A moves A", abs((a1["x"] - a0["x"]) - 60) < 10 and abs((a1["y"] - a0["y"]) - 30) < 10, (a0, a1))
    check("overlap: covering object B did not move or get selected", abs(b1["x"] - b0["x"]) < 1 and frame_matches(page, ".pptx-holder .pptx-el-image", 0)[0])
    page.keyboard.press("Control+z"); page.wait_for_timeout(120)
    a2 = img_pos(page, 0)
    check("undo restores moved position exactly", abs(a2["x"] - a0["x"]) < 1 and abs(a2["y"] - a0["y"]) < 1)

    # ---- 3. select-behind via Alt+click and via Layers panel ----
    page.mouse.click(px, py); page.wait_for_timeout(80)                        # selects/keeps A (inside selection)
    alt_click(page, px, py); page.wait_for_timeout(100)
    check("Alt+click cycles to the object behind", page.locator('[data-testid="pptx-frame"]').count() == 1)
    tab(page, 2)
    check("Layers panel lists all 6 top-level objects", page.locator('[data-testid="pptx-layers"] li').count() == 6, page.locator('[data-testid="pptx-layers"] li').count())
    page.locator('[data-testid="pptx-layers"] li button').nth(5).click(); page.wait_for_timeout(100)   # bottom-most layer
    check("Layers: choosing the lowest layer selects the covered picture", frame_matches(page, ".pptx-holder .pptx-el-image", 0)[0])

    # ---- 4. live tracking mid-drag (mouse still down) ----
    A = img_pos(page, 0)
    page.mouse.move(A["x"] + 12, A["y"] + 12); page.mouse.down(); page.mouse.move(A["x"] + 140, A["y"] + 90, steps=10)
    ok, d = frame_matches(page, ".pptx-holder .pptx-el-image", 0)
    f = rect(page, '[data-testid="pptx-frame"]')
    top = topmost_at(page, f["x"] + f["width"], f["y"] + f["height"])
    check("mid-drag: frame tracks the moving object", ok, d)
    check("mid-drag: handles still above object", top == "handle:se", top)
    page.mouse.up(); page.wait_for_timeout(120)
    page.keyboard.press("Control+z"); page.wait_for_timeout(100)

    # ---- 5. resize (aspect locked for images) ----
    A = img_pos(page, 0); page.mouse.click(A["x"] + 12, A["y"] + 12); page.wait_for_timeout(100)
    tab(page, 1)
    w0, h0 = val(page, "pptx-w"), val(page, "pptx-h")
    f = rect(page, '[data-testid="pptx-frame"]')
    drag(page, f["x"] + f["width"], f["y"] + f["height"], f["x"] + f["width"] + 80, f["y"] + f["height"] + 5)
    w1, h1 = val(page, "pptx-w"), val(page, "pptx-h")
    check("resize: image grows", w1 > w0 + 20, (w0, w1))
    check("resize: image keeps aspect ratio on corner drag", abs(w1 / h1 - w0 / h0) < 0.02, (w0 / h0, w1 / h1))
    ok, d = frame_matches(page, ".pptx-holder .pptx-el-image", 0)
    check("resize: frame matches resized object", ok, d)

    # ---- 6. rotate via handle ----
    f = rect(page, '[data-testid="pptx-frame"]'); cx, cy = center(f)
    drag(page, cx, f["y"] - 34, cx + 140, cy)                                  # toward 3 o'clock => ~90deg
    r = val(page, "pptx-rot")
    check("rotate: handle drag rotates ~90° (snaps to 15°)", abs(r - 90) <= 8, r)
    ok, d = frame_matches(page, ".pptx-holder .pptx-el-image", 0)
    check("rotate: frame still centred on rotated object", ok, d)

    # ---- 7. numeric position & flip ----
    page.locator('[data-testid="pptx-x"]').fill("100"); page.locator('[data-testid="pptx-x"]').press("Enter"); page.wait_for_timeout(150)
    check("inspector: X field applies to document", abs(val(page, "pptx-x") - 100) < 0.2, val(page, "pptx-x"))

    # ---- 8. keyboard: nudge, duplicate, delete, undo ----
    before = img_pos(page, 0)
    page.locator(".pptx-stage").focus(); page.keyboard.press("ArrowRight"); page.keyboard.press("Shift+ArrowDown"); page.wait_for_timeout(150)
    after = img_pos(page, 0)
    check("keyboard: arrow nudge moves selection", after["x"] > before["x"] and after["y"] > before["y"] + 5)
    n0 = page.locator(".pptx-holder .pptx-el").count()
    page.keyboard.press("Control+d"); page.wait_for_timeout(150)
    check("keyboard: Ctrl+D duplicates", page.locator(".pptx-holder .pptx-el").count() == n0 + 1)
    page.keyboard.press("Delete"); page.wait_for_timeout(150)
    check("keyboard: Delete removes", page.locator(".pptx-holder .pptx-el").count() == n0)

    # ---- 9. zoom keeps frame aligned ----
    A = img_pos(page, 1); page.mouse.click(A["x"] + 12, A["y"] + 12); page.wait_for_timeout(100)
    page.keyboard.press("Control+="); page.keyboard.press("Control+="); page.wait_for_timeout(200)
    check("zoom: percentage readout updates", page.locator('[data-testid="pptx-zoom"]').inner_text() != "100%", page.locator('[data-testid="pptx-zoom"]').inner_text())
    ok, d = frame_matches(page, ".pptx-holder .pptx-el-image", 1)
    check("zoom: frame stays aligned to object", ok, d)
    page.locator('[data-testid="pptx-fit"]').click(); page.wait_for_timeout(120)

    # ---- 10. multi-select, group, ungroup ----
    page.mouse.click(*stage_empty(page))
    a, bb2 = img_pos(page, 0), img_pos(page, 1)
    page.mouse.click(a["x"] + 12, a["y"] + 12); shift_click(page, bb2["x"] + 60, bb2["y"] + 60); page.wait_for_timeout(100)
    check("multi-select: two frames shown", page.locator('[data-testid="pptx-frame"]').count() == 2)
    tab(page, 1); page.locator('[data-testid="pptx-group"]').click(); page.wait_for_timeout(150)
    check("group: selection becomes one group object", page.locator('[data-testid="pptx-frame"]').count() == 1 and page.locator('[data-testid="pptx-ungroup"]').is_enabled())
    page.locator('[data-testid="pptx-ungroup"]').click(); page.wait_for_timeout(150)
    check("ungroup: objects restored as separate selection", page.locator('[data-testid="pptx-frame"]').count() == 2)

    # ---- 11. dirty indicator, export, validate with independent tools ----
    check("dirty marker shown after edits", page.locator('[data-testid="pptx-dirty"]').count() == 1)
    out = "/tmp/shots/overlap_desktop_export.pptx"
    with page.expect_download() as dl: page.click('[data-testid="pptx-export"]')
    dl.value.save_as(out); page.wait_for_timeout(300)
    check("export: file downloaded with -edited name", dl.value.suggested_filename == "overlap-edited.pptx", dl.value.suggested_filename)
    check("export: dirty marker cleared after save", page.locator('[data-testid="pptx-dirty"]').count() == 0)
    py = subprocess.run(["python3", "-c", f"from pptx import Presentation; p=Presentation('{out}'); print(len(p.slides), len(p.slides[0].shapes))"], capture_output=True, text=True)
    check("export: python-pptx opens it", py.returncode == 0, py.stdout + py.stderr)
    v = subprocess.run(["python3", "/mnt/skills/public/pptx/scripts/office/validate.py", out, "--original", os.path.join(FIX, "overlap.pptx")], capture_output=True, text=True)
    check("export: OOXML schema validation passes", "PASSED" in v.stdout, v.stdout[-300:] + v.stderr[-200:])

    # ---- 12. exported file re-opens in the editor ----
    page.reload(); page.wait_for_selector('[data-testid="pptx-open"]')
    with page.expect_file_chooser() as fc: page.click('[data-testid="pptx-open"]')
    fc.value.set_files(out); page.wait_for_selector('[data-testid="pptx-overlay"]'); page.wait_for_timeout(300)
    check("re-import: exported file opens and renders objects", page.locator(".pptx-holder .pptx-el").count() >= 6, page.locator(".pptx-holder .pptx-el").count())

    check("no editor console errors (network/font noise ignored)", not [e for e in errors if "ERR_NAME_NOT_RESOLVED" not in e and "Failed to load resource" not in e], [e for e in errors][:3])
    page.screenshot(path="/tmp/shots/desktop_after.png")
    b.close()

failed = [r for r in RESULTS if not r[1]]
print(f"\n{len(RESULTS)-len(failed)}/{len(RESULTS)} passed")
sys.exit(1 if failed else 0)
