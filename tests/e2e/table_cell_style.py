"""Selected cell gets a blue 4-side border; first text typed into an empty cell is centred, medium size."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append(bool(ok)); print(("PASS" if ok else "FAIL"), "-", name, detail if not ok else "")
CELL = lambda page, r, c: page.locator(f'.pptx-stage td[data-row="{r}"][data-col="{c}"]')
STYLE = """(el) => { const td=el; const cs=getComputedStyle(td); const ct=td.querySelector('.pptx-text-content'); const para=td.querySelector('.pptx-para');
  const range=document.createRange(); range.selectNodeContents(para); const tr=range.getBoundingClientRect(); const b=td.getBoundingClientRect();
  return {outline:cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor, align:getComputedStyle(para).textAlign, fs:parseFloat(getComputedStyle(para).fontSize),
          dx:Math.abs((tr.left+tr.right)/2-(b.left+b.right)/2), dy:Math.abs((tr.top+tr.bottom)/2-(b.top+b.bottom)/2)}; }"""

with sync_playwright() as p:
    b, c, page, errors = launch(p, viewport={"width": 1440, "height": 900})
    page.goto(URL); page.wait_for_selector('[data-testid="pptx-open"]')
    with page.expect_file_chooser() as fc: page.click('[data-testid="pptx-open"]')
    fc.value.set_files(os.path.join(FIX, "simple.pptx")); page.wait_for_selector('[data-testid="pptx-overlay"]'); page.wait_for_timeout(300)
    page.locator(".pe-ribbon-tabs button").nth(1).click(); page.click('[data-testid="pptx-insert-table"]'); page.click('[data-testid="pptx-create-table"]'); page.wait_for_timeout(400)
    page.screenshot(path="/tmp/t0.png")
    CELL(page, 1, 1).click(); page.wait_for_timeout(200)
    st = CELL(page, 1, 1).evaluate(STYLE)
    check("clicked cell has a 2px blue outline", "solid 2px" in st["outline"] and "37, 99, 235" in st["outline"], st)
    other = CELL(page, 0, 0).evaluate("el => getComputedStyle(el).outlineStyle")
    check("other cells have no outline", other == "none", other)
    page.keyboard.type("Hello"); page.wait_for_timeout(250)
    st = CELL(page, 1, 1).evaluate(STYLE)
    check("typed text is centred horizontally and vertically while editing", st["dx"] < 3 and st["dy"] < 3 and st["align"] == "center", st)
    check("typed text uses a medium size (>=20pt = 26.6px)", st["fs"] >= 26, st)
    page.screenshot(path="/tmp/t1.png")
    CELL(page, 2, 2).click(); page.wait_for_timeout(300)   # commits cell (1,1)
    st = CELL(page, 1, 1).evaluate(STYLE)
    check("after commit the saved text is still centred, medium", st["dx"] < 3 and st["dy"] < 3 and st["fs"] >= 26 and st["align"] == "center", st)
    page.keyboard.press("Escape"); page.wait_for_timeout(100); page.keyboard.press("Control+z"); page.wait_for_timeout(200)
    check("one undo removes the text", CELL(page, 1, 1).inner_text().strip() == "", CELL(page, 1, 1).inner_text())
    b.close()
sys.exit(0 if all(RESULTS) else 1)
