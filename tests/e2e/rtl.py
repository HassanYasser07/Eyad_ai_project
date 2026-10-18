"""Arabic / RTL checks: layout mirrors, text editor is RTL-aware, slide canvas stays LTR (geometry is not mirrored)."""
import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from common import *
R = []
def check(n, ok, d=""): R.append(ok); print("PASS" if ok else "FAIL", "-", n, "" if ok else d)
with sync_playwright() as p:
    for label, kw in [("desktop", dict(viewport={"width": 1440, "height": 900})), ("phone", dict(viewport={"width": 390, "height": 664}, device_scale_factor=2, is_mobile=True, has_touch=True))]:
        b, c, page, errors = launch(p, **kw)
        c.add_init_script("localStorage.setItem('eyad.language','ar')")
        open_fixture(page, "pptxgenjs_rich.pptx")
        check(f"{label}: root is dir=rtl", page.locator('[data-testid="pptx-editor"]').get_attribute("dir") == "rtl")
        check(f"{label}: Arabic title shown", "بيئة" in page.locator(".pe-top").inner_text() or page.locator('[data-testid="pptx-export"]').inner_text() in ("تصدير", ""))
        st = page.locator(".pptx-stage").evaluate("e => getComputedStyle(e.parentElement).direction")
        check(f"{label}: canvas area stays LTR (slide geometry never mirrored)", st == "ltr", st)
        page.locator('[data-testid="pptx-thumb-2"]').click() if label == "desktop" else page.click('[data-testid="pptx-next"]'); page.wait_for_timeout(250)
        if label == "phone": page.click('[data-testid="pptx-next"]'); page.wait_for_timeout(250)
        el = page.locator(".pptx-stage .pptx-el").filter(has_text="مرحبا").first.bounding_box()
        page.mouse.dblclick(el["x"] + el["width"] / 2, el["y"] + el["height"] / 2) if label == "desktop" else (page.touchscreen.tap(el["x"] + el["width"] / 2, el["y"] + el["height"] / 2), page.wait_for_timeout(120), page.touchscreen.tap(el["x"] + el["width"] / 2, el["y"] + el["height"] / 2))
        page.wait_for_selector('[data-testid="pptx-text-sheet"]', timeout=5000)
        ta = page.locator('[data-testid="pptx-textarea"]')
        check(f"{label}: textarea is RTL and holds the Arabic text", ta.get_attribute("dir") == "rtl" and "مرحبا" in ta.input_value(), ta.input_value())
        pdir = page.evaluate("() => document.querySelector('.pptx-stage .pptx-para[dir=rtl]') ? 'rtl' : 'none'")
        check(f"{label}: RTL slide paragraph rendered with dir=rtl", pdir == "rtl", pdir)
        page.screenshot(path=f"/tmp/shots/rtl_{label}.png")
        page.click('[data-testid="pptx-text-cancel"]')
        bad = [e for e in errors if "ERR_NAME_NOT_RESOLVED" not in e and "Failed to load" not in e]
        check(f"{label}: no console errors", not bad, bad[:2]); b.close()
print(f"{sum(R)}/{len(R)} passed"); sys.exit(0 if all(R) else 1)
