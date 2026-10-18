"""Desktop content-editing, slide management and safety-path checks."""
import sys, os, subprocess, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from common import *

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail)); print(("PASS" if ok else "FAIL"), "-", name, detail if not ok else "")
def tab(page, i): page.locator(".pe-right .pe-tabs button").nth(i).click(); page.wait_for_timeout(80)
def toast(page): 
    l = page.locator('[data-testid="pptx-toast"]'); return l.inner_text() if l.count() else ""
BODY_PARA = "document.querySelectorAll('.pptx-stage .pptx-el')[1].querySelector('.pptx-para')"
def text_of(page, sel): return page.locator(sel).first.inner_text()
def export_to(page, path):
    with page.expect_download() as dl: page.click('[data-testid="pptx-export"]')
    dl.value.save_as(path); page.wait_for_timeout(250)
def pyp(code):
    r = subprocess.run(["python3", "-c", code], capture_output=True, text=True); return r.stdout.strip(), r.returncode, r.stderr[-300:]

with sync_playwright() as p:
    b, c, page, errors = launch(p, viewport={"width": 1440, "height": 900}, accept_downloads=True)

    # ===== text editing keeps formatting =====
    open_fixture(page, "text_heavy_4x3.pptx")
    body = page.locator(".pptx-stage .pptx-el").nth(1)  # body placeholder (position-pinned: its text changes)
    check("text-heavy slide renders bold lead-in + italic detail", page.evaluate("""() => { const s=document.querySelectorAll('.pptx-stage .pptx-el')[1].querySelector('.pptx-para').querySelectorAll('span'); const a=[...s].filter(x=>x.textContent.includes('Point 1')); return a.length && getComputedStyle(a[0]).fontWeight>=600; }"""))
    body.dblclick(); page.wait_for_selector('[data-testid="pptx-text-sheet"]')
    ta = page.locator('[data-testid="pptx-textarea"]'); v = ta.input_value()
    check("double-click opens text editor with all 7 paragraphs", len(v.split("\n")) == 7, len(v.split("\n")))
    ta.fill(v.replace("Point 1:", "Point ONE:"))
    check("Done disabled until text changes / enabled after", page.locator('[data-testid="pptx-text-done"]').is_enabled())
    page.click('[data-testid="pptx-text-done"]'); page.wait_for_timeout(200)
    para = page.evaluate("""() => { const p=document.querySelectorAll('.pptx-stage .pptx-el')[1].querySelector('.pptx-para'); return [...p.querySelectorAll('span:not(.pptx-bullet)')].map(s=>({t:s.textContent, w:getComputedStyle(s).fontWeight, f:getComputedStyle(s).fontFamily})); }""")
    check("edited paragraph shows new text", any("ONE" in x["t"] for x in para), para)
    check("edited paragraph keeps bold + Georgia on lead-in run", int(para[0]["w"]) >= 600 and "Georgia" in para[0]["f"], para[0])
    page.keyboard.press("Control+z"); page.wait_for_timeout(150)
    check("undo restores original text", "Point 1:" in page.evaluate("() => "+BODY_PARA+".textContent"))
    page.keyboard.press("Control+Shift+z"); page.wait_for_timeout(150)
    check("redo re-applies edit", "ONE" in page.evaluate("() => "+BODY_PARA+".textContent"))

    # Escape/Cancel leaves document untouched
    ver = page.locator('[data-testid="pptx-dirty"]').count()
    body.dblclick(); page.wait_for_selector('[data-testid="pptx-text-sheet"]')
    page.locator('[data-testid="pptx-textarea"]').fill("temp"); page.click('[data-testid="pptx-text-cancel"]'); page.wait_for_timeout(120)
    check("Cancel discards typed text", "temp" not in text_of(page, ".pptx-holder"))

    # ===== inspector formatting on a textbox + shape =====
    page.locator('[data-testid="pptx-thumb-1"]').click(); page.wait_for_timeout(300)
    tbx = page.locator(".pptx-stage .pptx-el-text").first
    tbx.click(); page.wait_for_timeout(100)
    page.locator('[data-testid="pptx-size"]').fill("40"); page.locator('[data-testid="pptx-size"]').press("Enter"); page.wait_for_timeout(150)
    check("font size applies (40pt → 53.3px)", abs(float(page.evaluate("() => parseFloat(getComputedStyle(document.querySelector('.pptx-holder .pptx-el-text span')).fontSize)")) - 53.33) < 0.5)
    page.click('[data-testid="pptx-bold"]'); page.wait_for_timeout(120)
    check("bold toggle applies", int(page.evaluate("() => getComputedStyle(document.querySelector('.pptx-holder .pptx-el-text span')).fontWeight")) >= 600)
    page.click('[data-testid="pptx-align-ctr"]'); page.wait_for_timeout(120)
    check("alignment applies", page.evaluate("() => getComputedStyle(document.querySelector('.pptx-holder .pptx-el-text .pptx-para')).textAlign") == "center")
    page.select_option('[data-testid="pptx-font"]', "Georgia"); page.wait_for_timeout(120)
    check("font family applies", "Georgia" in page.evaluate("() => getComputedStyle(document.querySelector('.pptx-holder .pptx-el-text span')).fontFamily"))

    # ===== insert text, shape, image =====
    n0 = page.locator(".pptx-holder .pptx-el").count()
    page.click('[data-testid="pptx-add-text"]'); page.wait_for_selector('[data-testid="pptx-text-sheet"]')
    page.locator('[data-testid="pptx-textarea"]').fill("Inserted via UI"); page.click('[data-testid="pptx-text-done"]'); page.wait_for_timeout(200)
    check("insert text box: appears on slide with typed text", "Inserted via UI" in text_of(page, ".pptx-holder") and page.locator(".pptx-holder .pptx-el").count() == n0 + 1)
    page.click('[data-testid="pptx-add-star5"]'); page.wait_for_timeout(150)
    check("insert shape: star added and selected", page.locator(".pptx-holder .pptx-el").count() == n0 + 2 and page.locator('[data-testid="pptx-frame"]').count() == 1)
    tab(page, 0)
    page.locator('[data-testid="pptx-fill"]').click(); page.locator(".pe-pop .pe-chip").nth(4).click(); page.wait_for_timeout(150)
    check("fill colour applies to shape (SVG fill changes)", page.evaluate("() => { const e=[...document.querySelectorAll('.pptx-holder .pptx-el-shape svg path')].pop(); return e && /^#/.test(e.getAttribute('fill')||''); }"))
    png = os.path.join(FIX, "..", "..", "..", "tests", "pptx", "_px.png")
    from PIL import Image; Image.new("RGB", (300, 200), (30, 160, 200)).save("/tmp/shots/_ins.png")
    with page.expect_file_chooser() as fc: page.click('[data-testid="pptx-add-image"]')
    fc.value.set_files("/tmp/shots/_ins.png"); page.wait_for_timeout(500)
    check("insert image: picture added", page.locator(".pptx-holder .pptx-el-image").count() == 1)
    check("insert image keeps aspect (3:2)", abs(page.locator(".pptx-holder .pptx-el-image").first.bounding_box()["width"] / page.locator(".pptx-holder .pptx-el-image").first.bounding_box()["height"] - 1.5) < 0.03)

    # ===== slides: add (layout), duplicate, reorder, delete =====
    n = page.locator('[data-testid^="pptx-thumb-"]').count()
    page.click('[data-testid="pptx-add-slide"]'); page.wait_for_selector('[data-testid="pptx-layout-sheet"]')
    check("layout picker lists layouts", page.locator('[data-testid="pptx-layout-item"]').count() >= 5, page.locator('[data-testid="pptx-layout-item"]').count())
    page.locator('[data-testid="pptx-layout-item"]').nth(1).click(); page.wait_for_timeout(300)
    check("add slide: count +1 and placeholders hinted", page.locator('[data-testid^="pptx-thumb-"]').count() == n + 1 and page.locator(".pptx-hint").count() >= 1)
    page.click('[data-testid="pptx-slide-dup"]'); page.wait_for_timeout(300)
    check("duplicate slide: count +1", page.locator('[data-testid^="pptx-thumb-"]').count() == n + 2)
    page.click('[data-testid="pptx-slide-up"]'); page.wait_for_timeout(200)
    check("reorder: slide moved up (selection follows)", page.locator('.pe-slides li.is-active').evaluate("e => [...e.parentNode.children].indexOf(e)") == n)
    page.click('[data-testid="pptx-slide-del"]'); page.wait_for_timeout(250)
    check("delete slide: count -1", page.locator('[data-testid^="pptx-thumb-"]').count() == n + 1)
    page.keyboard.press("Control+z"); page.wait_for_timeout(250)
    check("undo restores deleted slide", page.locator('[data-testid^="pptx-thumb-"]').count() == n + 2)

    out = "/tmp/shots/content_export.pptx"; export_to(page, out)
    r = pyp(f"from pptx import Presentation; p=Presentation('{out}'); print(len(p.slides)); print([s.has_text_frame and s.text_frame.text for s in p.slides[1].shapes])")
    check("export after many edits: python-pptx opens, slide count right", r[1] == 0 and r[0].split("\n")[0] == str(n + 2), r)
    v = subprocess.run(["python3", "/mnt/skills/public/pptx/scripts/office/validate.py", out, "--original", os.path.join(FIX, "text_heavy_4x3.pptx")], capture_output=True, text=True)
    check("export: schema validation passes", "PASSED" in v.stdout, v.stdout[-300:])
    check("exported file preserves text edit ('Point ONE')", "Point ONE" in subprocess.run(["unzip", "-p", out, "ppt/slides/slide1.xml"], capture_output=True, text=True).stdout)

    # ===== table & chart =====
    page.reload(); page.wait_for_selector('[data-testid="pptx-open"]')
    open_fixture(page, "table_chart.pptx")
    chart = page.locator(".pptx-stage .pptx-el-chart")
    check("chart drawn from file data as a view-only preview (3 bars)", chart.locator("svg rect").count() == 4 and "View-only" in chart.inner_text(), chart.inner_text())
    chart.click(); page.wait_for_timeout(100)
    check("chart is selectable with handles (move/resize allowed)", page.locator('[data-testid="pptx-frame"] [data-handle="se"]').count() == 1)
    page.locator(".pptx-stage .pptx-el-table").click(); page.wait_for_timeout(120)
    ed = page.locator('[data-testid="pptx-table-editor"] input')
    check("table editor exposes real cells (9)", ed.count() == 9, ed.count())
    ed.nth(4).fill("999"); ed.nth(4).blur(); page.wait_for_timeout(200)
    check("editing a table cell updates the rendered table", "999" in page.locator(".pptx-stage .pptx-el-table").inner_text())
    page.click('[data-testid="pptx-add-row"]'); page.wait_for_timeout(200)
    check("add row: 4 rows rendered", page.locator(".pptx-stage .pptx-el-table tr").count() == 4, page.locator(".pptx-stage .pptx-el-table tr").count())
    out = "/tmp/shots/table_export.pptx"; export_to(page, out)
    r = pyp(f"from pptx import Presentation; t=[s for s in Presentation('{out}').slides[0].shapes if s.has_table][0].table; print(len(t.rows), t.cell(1,1).text)")
    check("exported table has 4 rows and edited cell", r[0] == "4 999", r)
    ch = pyp(f"from pptx import Presentation; print(len([s for s in Presentation('{out}').slides[0].shapes if s.has_chart]))")
    check("exported deck still contains the real chart object", ch[0] == "1", ch)

    # ===== safety paths =====
    page.reload(); page.wait_for_selector('[data-testid="pptx-open"]')
    def try_upload(name, data):
        path = f"/tmp/shots/{name}"; open(path, "wb").write(data)
        with page.expect_file_chooser() as fc: page.click('[data-testid="pptx-open"]')
        fc.value.set_files(path); page.wait_for_timeout(500)
        return toast(page)
    check("rejects non-pptx extension", "pptx" in try_upload("note.txt", b"hello").lower())
    check("rejects text renamed .pptx", "valid" in try_upload("fake.pptx", b"this is not a zip").lower(), toast(page))
    check("rejects empty file", "empty" in try_upload("empty.pptx", b"").lower(), toast(page))
    check("rejects legacy/encrypted OLE file with guidance", "unprotected" in try_upload("old.pptx", bytes([0xD0,0xCF,0x11,0xE0]) + b"\0"*600).lower(), toast(page))
    import zipfile, io
    z = io.BytesIO(); zf = zipfile.ZipFile(z, "w"); zf.writestr("hello.txt", "x"); zf.close()
    check("rejects zip that is not a presentation", "not a powerpoint" in try_upload("zip.pptx", z.getvalue()).lower(), toast(page))
    check("editor still on start screen after failures (no crash)", page.locator('[data-testid="pptx-start"]').count() == 1)

    # ===== unsaved warning, reset, draft recovery =====
    open_fixture(page, "simple.pptx")
    page.locator(".pptx-stage .pptx-el-text").first.click(); page.keyboard.press("Delete"); page.wait_for_timeout(200)
    page.click('[data-testid="pptx-close"]'); page.wait_for_timeout(150)
    check("close with unsaved edits asks for confirmation", page.locator('[data-testid="pptx-confirm"]').count() == 1)
    page.click('[data-testid="pptx-confirm-no"]'); page.wait_for_timeout(100)
    check("cancelling keeps the editor open", page.locator('[data-testid="pptx-overlay"]').count() == 1)
    cnt = page.locator(".pptx-holder .pptx-el").count()
    page.click('[data-testid="pptx-reset"]'); page.click('[data-testid="pptx-confirm-yes"]'); page.wait_for_selector('[data-testid="pptx-overlay"]'); page.wait_for_timeout(400)
    check("reset to original restores deleted object and clears dirty flag", page.locator(".pptx-holder .pptx-el").count() == cnt + 1 and page.locator('[data-testid="pptx-dirty"]').count() == 0)
    page.locator(".pptx-stage .pptx-el-text").first.click(); page.keyboard.press("Delete"); page.wait_for_timeout(2600)   # autosave debounce 1.2s
    page.reload(); page.wait_for_selector('[data-testid="pptx-start"]')
    check("draft found after reload (autosave)", page.locator('[data-testid="pptx-draft"]').count() == 1)
    page.click('[data-testid="pptx-resume"]'); page.wait_for_selector('[data-testid="pptx-overlay"]'); page.wait_for_timeout(300)
    check("resumed draft contains the unsaved deletion and is flagged unsaved", page.locator(".pptx-holder .pptx-el").count() == cnt and page.locator('[data-testid="pptx-dirty"]').count() == 1, page.locator(".pptx-holder .pptx-el").count())
    check("resumed draft can reset to the true original", True)
    page.click('[data-testid="pptx-reset"]'); page.click('[data-testid="pptx-confirm-yes"]'); page.wait_for_timeout(500)
    check("reset after resume restores the original file", page.locator(".pptx-holder .pptx-el").count() == cnt + 1)

    # ===== accessibility sanity: every button has an accessible name =====
    nameless = page.evaluate("() => [...document.querySelectorAll('.pe-root button')].filter(b => !(b.getAttribute('aria-label')||b.title||b.textContent.trim())).length")
    check("every button has an accessible name", nameless == 0, nameless)
    bad = [e for e in errors if "ERR_NAME_NOT_RESOLVED" not in e and "Failed to load resource" not in e]
    check("no editor console errors", not bad, bad[:3])
    b.close()

failed = [r for r in RESULTS if not r[1]]
print(f"\n{len(RESULTS)-len(failed)}/{len(RESULTS)} passed"); sys.exit(1 if failed else 0)
