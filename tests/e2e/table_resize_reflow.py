"""Resizing a table must scale its grid, re-wrap cell text and keep the frame = the rendered table."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append(bool(ok)); print(("PASS" if ok else "FAIL"), "-", name, detail if not ok else "")

# frame box vs the really rendered table box (both screen px; 1px tolerance)
GEO = """() => { const f=document.querySelector('[data-testid="pptx-frame"]').getBoundingClientRect();
  const t=document.querySelector('.pptx-stage .pptx-el-table table').getBoundingClientRect();
  return {fh:f.height, th:t.height, fw:f.width, tw:t.width}; }"""
def drag(page, handle, dx, dy):
    h = page.locator(f'[data-handle="{handle}"]').first.bounding_box()
    x, y = h["x"] + h["width"] / 2, h["y"] + h["height"] / 2
    page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x + dx / 2, y + dy / 2, steps=4); page.mouse.move(x + dx, y + dy, steps=6)
    mid = page.evaluate(GEO); page.mouse.up(); page.wait_for_timeout(250)
    return mid

with sync_playwright() as p:
    b, c, page, errors = launch(p, viewport={"width": 1440, "height": 900})
    open_fixture(page, "table_chart.pptx")
    page.locator(".pptx-stage .pptx-el-table").first.click(position={"x": 5, "y": 5}); page.wait_for_timeout(150)
    g0 = page.evaluate(GEO)
    check("initial frame matches table", abs(g0["fh"] - g0["th"]) < 2 and abs(g0["fw"] - g0["tw"]) < 2, g0)
    mid = drag(page, "e", -300, 0)
    g1 = page.evaluate(GEO)
    check("narrow: frame == table during drag", abs(mid["fh"] - mid["th"]) < 2, mid)
    check("narrow: frame == table after commit (text re-wrapped, nothing overflows)", abs(g1["fh"] - g1["th"]) < 2 and abs(g1["fw"] - g1["tw"]) < 2, g1)
    check("narrowing made the table taller or equal", g1["fh"] >= g0["fh"] - 1, (g0, g1))
    drag(page, "s", 0, -700)
    g2 = page.evaluate(GEO)
    check("vertical shrink stops at the content minimum (frame still == table)", abs(g2["fh"] - g2["th"]) < 2 and g2["fh"] > 20, g2)
    drag(page, "s", 0, 120)
    g3 = page.evaluate(GEO)
    check("growing taller works and frame == table", g3["fh"] > g2["fh"] + 20 and abs(g3["fh"] - g3["th"]) < 2, (g2, g3))
    page.keyboard.press("Control+z"); page.wait_for_timeout(150)
    b.close()
sys.exit(0 if all(RESULTS) else 1)
