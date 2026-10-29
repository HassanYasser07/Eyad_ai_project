"""Resizing a text frame must re-flow the text and keep the frame at least as tall as its text."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append(bool(ok)); print(("PASS" if ok else "FAIL"), "-", name, detail if not ok else "")

# frame height vs the real wrapped text height (both in slide px, independent of zoom)
FIT = """() => { const f=document.querySelector('[data-testid="pptx-frame"]'); const id=f.dataset.id;
  const el=document.querySelector('.pptx-stage .pptx-el[data-id="'+id+'"]'); const t=el.querySelector('.pptx-text'); const c=t.querySelector('.pptx-text-content');
  const css=getComputedStyle(t); const pad=parseFloat(css.paddingTop)+parseFloat(css.paddingBottom);
  const need=Math.max(c.scrollHeight,c.offsetHeight)+pad; const hostH=el.offsetHeight; return {need, hostH, lines: c.getBoundingClientRect().height}; }"""

def drag(page, handle, dx, dy):
    h = page.locator(f'[data-handle="{handle}"]').first.bounding_box()
    x, y = h["x"] + h["width"] / 2, h["y"] + h["height"] / 2
    page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x + dx / 2, y + dy / 2, steps=4); page.mouse.move(x + dx, y + dy, steps=6)
    mid = page.evaluate(FIT)           # mid-drag draft must already be fitted
    page.mouse.up(); page.wait_for_timeout(250)
    return mid

with sync_playwright() as p:
    b, c, page, errors = launch(p, viewport={"width": 1440, "height": 900})
    open_fixture(page, "text_heavy_4x3.pptx")
    el = page.locator(".pptx-stage .pptx-el").nth(1)   # body placeholder with several paragraphs
    el.click(); page.wait_for_timeout(150)
    before = page.evaluate(FIT)
    mid = drag(page, "e", -260, 0)     # narrow from the right edge -> more wrapping
    after = page.evaluate(FIT)
    check("narrowing width grows frame to fit re-wrapped text (during drag)", mid["hostH"] + 1 >= mid["need"], mid)
    check("narrowing width grows frame to fit re-wrapped text (after commit)", after["hostH"] + 1 >= after["need"], after)
    check("frame got taller than before", after["hostH"] > before["hostH"], (before, after))
    drag(page, "s", 0, -600)           # try to collapse height far below the text
    mn = page.evaluate(FIT)
    check("vertical shrink stops at the text minimum", mn["hostH"] + 1 >= mn["need"] and mn["hostH"] <= mn["need"] + 3, mn)
    page.keyboard.press("Control+z"); page.wait_for_timeout(150)
    check("no console errors", not errors, errors[:3])
    b.close()
sys.exit(0 if all(RESULTS) else 1)
