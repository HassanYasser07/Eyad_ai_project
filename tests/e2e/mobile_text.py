"""Mobile text editing, keyboard/viewport, rotation, safe-area and lifecycle checks (emulation only)."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail)); print(("PASS" if ok else "FAIL"), "-", name, detail if not ok else "")
def box(page, sel, nth=0): return page.locator(sel).nth(nth).bounding_box()
def cen(b): return (b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)
def frames(page): return page.locator('[data-testid="pptx-frame"]').count()
def draft_exists(page):
    return page.evaluate("""() => new Promise(res => { const r = indexedDB.open('eyad-pptx-editor', 1); r.onerror = () => res(false);
      r.onsuccess = () => { try { const g = r.result.transaction('drafts').objectStore('drafts').get('current'); g.onsuccess = () => res(!!g.result); g.onerror = () => res(false); } catch (e) { res(false); } }; })""")

with sync_playwright() as p:
    vp = {"width": 390, "height": 664}
    b, c, page, errors = launch(p, viewport=vp, device_scale_factor=3, is_mobile=True, has_touch=True)
    cdp = c.new_cdp_session(page)

    # ---------- safe areas (CDP safe-area override: top notch 47, bottom home indicator 34) ----------
    safe_ok = True
    try: cdp.send("Emulation.setSafeAreaInsetsOverride", {"insets": {"top": 47, "bottom": 34, "left": 0, "right": 0}})
    except Exception as e: safe_ok = False; print("safe-area override unsupported:", str(e)[:80])
    open_fixture(page, "simple.pptx")
    if safe_ok:
        pt = page.evaluate("() => parseFloat(getComputedStyle(document.querySelector('.pe-top')).paddingTop)")
        pb = page.evaluate("() => parseFloat(getComputedStyle(document.querySelector('.pe-bottom')).paddingBottom)")
        check("safe area: top bar clears the notch (padding-top >= 47px)", pt >= 47, pt)
        check("safe area: bottom bar clears the home indicator (padding-bottom >= 34px)", pb >= 34, pb)
        top_btn = box(page, '[data-testid="pptx-close"]'); check("safe area: close button sits below the notch", top_btn["y"] >= 47, top_btn)
        bb = box(page, '[data-testid="pptx-bottombar"]'); check("safe area: bottom bar content stays above the home indicator", bb["y"] + bb["height"] <= vp["height"] + 0.5)
    else: check("safe area override unavailable in this Chrome (NOT verified)", True)

    # ---------- text editing mode ----------
    title = box(page, ".pptx-stage .pptx-el-text", 0)
    page.touchscreen.tap(*cen(title)); page.wait_for_timeout(200)
    check("tap selects the title placeholder", frames(page) == 1)
    check("contextual bar offers 'Edit text'", page.locator('[data-testid="pptx-edit-text"]').count() == 1)
    page.click('[data-testid="pptx-edit-text"]'); page.wait_for_selector('[data-testid="pptx-text-sheet"]'); page.wait_for_timeout(250)
    focused = page.evaluate("() => document.activeElement && document.activeElement.dataset.testid")
    check("text sheet auto-focuses the native textarea (keyboard opens)", focused == "pptx-textarea", focused)
    ta = page.locator('[data-testid="pptx-textarea"]')
    check("textarea font >= 16px (prevents iOS focus-zoom)", float(page.evaluate("() => parseFloat(getComputedStyle(document.querySelector('[data-testid=\"pptx-textarea\"]')).fontSize)")) >= 16)
    st = box(page, ".pptx-stage"); sh = box(page, '[data-testid="pptx-text-sheet"]')
    check("canvas stays visible above the text sheet", st["height"] > 120 and st["y"] + st["height"] <= sh["y"] + 2, (st, sh))

    # software keyboard appears: viewport shrinks
    page.set_viewport_size({"width": 390, "height": 340}); page.wait_for_timeout(350)
    sh = box(page, '[data-testid="pptx-text-sheet"]'); done = box(page, '[data-testid="pptx-text-done"]'); tab = box(page, '[data-testid="pptx-textarea"]'); st = box(page, ".pptx-stage")
    check("keyboard open: sheet fully inside the visible area", sh["y"] >= 0 and sh["y"] + sh["height"] <= 341, sh)
    check("keyboard open: Done button and textarea reachable", done["y"] + done["height"] <= 341 and tab["y"] >= 0, (done, tab))
    check("keyboard open: some canvas remains", st["height"] > 40, st)
    ta.fill(""); page.keyboard.type("Hello from the phone keyboard")
    check("typing with the keyboard works", ta.input_value() == "Hello from the phone keyboard", ta.input_value())
    # dismiss keyboard WITHOUT leaving text mode
    page.evaluate("() => document.activeElement.blur()"); page.set_viewport_size(vp); page.wait_for_timeout(350)
    check("dismissing the keyboard keeps the sheet and the typed text", page.locator('[data-testid="pptx-text-sheet"]').count() == 1 and ta.input_value() == "Hello from the phone keyboard")
    check("document not changed until Done (no draft edit leaked)", "Hello from the phone" not in page.locator(".pptx-stage").inner_text())
    page.click('[data-testid="pptx-text-done"]'); page.wait_for_timeout(300)
    check("Done commits the text to the slide", "Hello from the phone keyboard" in page.locator(".pptx-stage").inner_text())
    check("sheet closed after Done", page.locator('[data-testid="pptx-text-sheet"]').count() == 0)
    page.click('[data-testid="pptx-undo"]'); page.wait_for_timeout(200)
    check("undo reverts the committed text", "Hello from the phone" not in page.locator(".pptx-stage").inner_text())

    # inserting new text opens straight into text mode
    page.touchscreen.tap(*(box(page, ".pe-main")["x"] + 6, box(page, ".pe-main")["y"] + 6)); page.wait_for_timeout(100)
    page.click('[data-testid="pptx-add-text"]'); page.wait_for_selector('[data-testid="pptx-text-sheet"]')
    page.keyboard.press("Control+a"); page.keyboard.type("Brand new box"); page.click('[data-testid="pptx-text-done"]'); page.wait_for_timeout(250)
    check("insert text on phone: typed text lands on the slide", "Brand new box" in page.locator(".pptx-stage").inner_text())

    # ---------- rotation (portrait -> landscape) with a selection ----------
    el = box(page, ".pptx-stage .pptx-el-text", 2)
    page.touchscreen.tap(*cen(el)); page.wait_for_timeout(150)
    check("before rotation: object selected", frames(page) == 1)
    page.set_viewport_size({"width": 844, "height": 390}); page.wait_for_timeout(500)
    check("landscape: compact layout kept (touch landscape phone)", page.locator(".pe-root.is-compact").count() == 1)
    st = box(page, ".pptx-stage"); ho = box(page, ".pptx-holder")
    check("landscape: slide re-fits inside the stage", ho["x"] >= -1 and ho["y"] >= st["y"] - 1 and ho["x"] + ho["width"] <= 845 and ho["y"] + ho["height"] <= st["y"] + st["height"] + 1, (ho, st))
    check("landscape: selection survives rotation", frames(page) == 1)
    f = box(page, '[data-testid="pptx-frame"]'); e2 = box(page, ".pptx-stage .pptx-el-text", 2)
    check("landscape: selection frame still glued to the object", abs(cen(f)[0] - cen(e2)[0]) < 3 and abs(cen(f)[1] - cen(e2)[1]) < 3, (cen(f), cen(e2)))
    bb = box(page, '[data-testid="pptx-bottombar"]'); check("landscape: bottom bar visible and inside screen", bb["y"] + bb["height"] <= 391 and bb["height"] >= 44, bb)
    check("landscape: no horizontal overflow", page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth") <= 0)
    page.screenshot(path="/tmp/shots/mobile_landscape.png")
    page.set_viewport_size(vp); page.wait_for_timeout(400)
    check("back to portrait: selection still present and aligned", frames(page) == 1 and abs(cen(box(page, '[data-testid="pptx-frame"]'))[0] - cen(box(page, ".pptx-stage .pptx-el-text", 2))[0]) < 3)

    # ---------- backgrounding & WebView kill ----------
    page.keyboard.press("Delete"); page.wait_for_timeout(100)     # make an unsaved edit (hardware key)
    if not page.locator('[data-testid="pptx-dirty"]').count(): page.click('[data-testid="pptx-delete"]'); page.wait_for_timeout(150)
    n_before = page.locator(".pptx-stage .pptx-el").count()
    page.evaluate("() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }")
    page.wait_for_timeout(500)
    check("app backgrounded: draft flushed immediately (no 1.2s debounce wait)", draft_exists(page))
    page.evaluate("() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }")
    check("returning to foreground: document and edits intact", page.locator(".pptx-stage .pptx-el").count() == n_before and page.locator('[data-testid="pptx-dirty"]').count() == 1)
    page.reload(); page.wait_for_selector('[data-testid="pptx-start"]')
    check("WebView killed/reloaded: draft offered on next open", page.locator('[data-testid="pptx-draft"]').count() == 1)
    page.click('[data-testid="pptx-resume"]'); page.wait_for_selector('[data-testid="pptx-overlay"]'); page.wait_for_timeout(400)
    check("resumed draft has the unsaved edit and is marked unsaved", page.locator(".pptx-stage .pptx-el").count() == n_before and page.locator('[data-testid="pptx-dirty"]').count() == 1)

    # ---------- table editing from the property sheet ----------
    open_fixture(page, "table_chart.pptx")
    tb = box(page, ".pptx-stage .pptx-el-table"); page.touchscreen.tap(*cen(tb)); page.wait_for_timeout(200)
    page.click('[data-testid="pptx-style"]'); page.wait_for_selector('[data-testid="pptx-table-editor"]'); page.wait_for_timeout(250)
    inp = page.locator('[data-testid="pptx-table-editor"] input')
    check("table editor in the sheet lists 9 cells", inp.count() == 9, inp.count())
    inp.nth(4).fill("777"); inp.nth(4).blur(); page.wait_for_timeout(250)
    check("editing a cell on phone updates the table", "777" in page.locator(".pptx-stage .pptx-el-table").inner_text())

    bad = [e for e in errors if "ERR_NAME_NOT_RESOLVED" not in e and "Failed to load" not in e]
    check("no console errors", not bad, bad[:3])
    b.close()

failed = [r for r in RESULTS if not r[1]]
print(f"\n{len(RESULTS)-len(failed)}/{len(RESULTS)} passed"); sys.exit(1 if failed else 0)
