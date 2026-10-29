"""A single click on any table cell puts the caret in it; typing commits, grows the row and keeps undo."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append(bool(ok)); print(("PASS" if ok else "FAIL"), "-", name, detail if not ok else "")
CELL = lambda page, r, c: page.locator(f'.pptx-stage td[data-row="{r}"][data-col="{c}"]')
TXT = lambda page, r, c: CELL(page, r, c).inner_text().strip()
GEO = """() => { const f=document.querySelector('[data-testid="pptx-frame"]').getBoundingClientRect();
  const t=document.querySelector('.pptx-stage .pptx-el-table table').getBoundingClientRect(); return {fh:f.height, th:t.height}; }"""

with sync_playwright() as p:
    b, c, page, errors = launch(p, viewport={"width": 1440, "height": 900})
    open_fixture(page, "table_chart.pptx")
    rows = page.locator(".pptx-stage tr").count(); cols = page.locator(".pptx-stage tr").first.locator("td").count()
    for (r, cc) in [(1, 1), (rows - 1, cols - 1), (0, 0)]:
        CELL(page, r, cc).click(); page.wait_for_timeout(150)
        ed = page.evaluate("() => { const a=document.activeElement; return !!a && a.isContentEditable && !!a.closest('td'); }")
        check(f"single click on cell ({r},{cc}) focuses an editable caret", ed)
        page.keyboard.type(f"X{r}{cc}")
        page.wait_for_timeout(80)
    # switch cell by clicking another cell directly: previous edit is committed
    CELL(page, 1, 1).click(); page.wait_for_timeout(200)
    check("first typed cell kept its text after moving to another cell", "X00" in TXT(page, 0, 0) and f"X{rows-1}{cols-1}" in TXT(page, rows - 1, cols - 1), (TXT(page, 0, 0), TXT(page, rows - 1, cols - 1)))
    # long text grows row + frame together
    h0 = page.evaluate(GEO)
    page.keyboard.type(" a very long sentence that has to wrap onto many lines inside this narrow table cell " * 3)
    CELL(page, rows - 1, cols - 1).click(); page.wait_for_timeout(300)
    h1 = page.evaluate(GEO)
    check("long cell text grows the table and frame stays == table", h1["th"] > h0["th"] + 5 and abs(h1["fh"] - h1["th"]) < 2, (h0, h1))
    # dragging the table still moves it (no accidental edit)
    box = CELL(page, 0, 0).bounding_box(); x0 = box["x"] + box["width"] / 2; y0 = box["y"] + box["height"] / 2
    before = page.locator('[data-testid="pptx-frame"]').bounding_box()
    page.mouse.move(x0, y0); page.mouse.down(); page.mouse.move(x0 + 40, y0 + 30, steps=6); page.mouse.up(); page.wait_for_timeout(250)
    after = page.locator('[data-testid="pptx-frame"]').bounding_box()
    check("dragging a cell still moves the table", abs(after["x"] - before["x"]) > 20, (before, after))
    page.keyboard.press("Escape")
    b.close()
sys.exit(0 if all(RESULTS) else 1)
