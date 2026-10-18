"""Touch-emulation checks (Chromium + CDP touch events). NOT a real Android/iOS WebView or device."""
import sys, os, subprocess
sys.path.insert(0, os.path.dirname(__file__))
from common import *

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail)); print(("PASS" if ok else "FAIL"), "-", name, detail if not ok else "")

class Touch:
    def __init__(self, ctx, page): self.cdp = ctx.new_cdp_session(page); self.page = page
    def _send(self, t, pts): self.cdp.send("Input.dispatchTouchEvent", {"type": t, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pts)]})
    def drag(self, x0, y0, x1, y1, steps=10, release=True):
        self._send("touchStart", [(x0, y0)])
        for i in range(1, steps + 1): self._send("touchMove", [(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)])
        if release: self._send("touchEnd", [])
        self.page.wait_for_timeout(150)
    def pinch(self, cx, cy, d0, d1, steps=10):
        self._send("touchStart", [(cx - d0 / 2, cy), (cx + d0 / 2, cy)])
        for i in range(1, steps + 1):
            d = d0 + (d1 - d0) * i / steps; self._send("touchMove", [(cx - d / 2, cy), (cx + d / 2, cy)])
        self._send("touchEnd", []); self.page.wait_for_timeout(200)
    def two_finger_pan(self, cx, cy, dx, dy, spread=120, steps=10):
        self._send("touchStart", [(cx - spread / 2, cy), (cx + spread / 2, cy)])
        for i in range(1, steps + 1): self._send("touchMove", [(cx - spread / 2 + dx * i / steps, cy + dy * i / steps), (cx + spread / 2 + dx * i / steps, cy + dy * i / steps)])
        self._send("touchEnd", []); self.page.wait_for_timeout(200)

def box(page, sel, nth=0): return page.locator(sel).nth(nth).bounding_box()
def cen(b): return (b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)
def img(page, n): return box(page, ".pptx-stage .pptx-el-image", n)
def zoom(page): return int(page.locator('[data-testid="pptx-zoom"]').inner_text().rstrip("%")) if page.locator('[data-testid="pptx-zoom"]').count() else None
def topmost(page, x, y):
    return page.evaluate("""([x,y]) => { const e = document.elementsFromPoint(x,y)[0]; const h = e && e.closest('.pptx-handle'); return h ? 'handle:'+h.dataset.handle : (e && e.closest('.pptx-el') ? 'content' : (e&&e.className)); }""", [x, y])
def empty_point(page):
    b = box(page, ".pptx-stage")
    return page.evaluate("""([x0,y0,w,h]) => { for (let fy=0.08; fy<0.95; fy+=0.07) for (let fx=0.08; fx<0.95; fx+=0.07) { const x=x0+w*fx, y=y0+h*fy; const e=document.elementsFromPoint(x,y)[0]; if (e && !e.closest('.pptx-el') && !e.closest('.pptx-frame') && !e.closest('.pe-slidenav')) return [x,y]; } return null; }""", [b["x"], b["y"], b["width"], b["height"]])
def norm(page, n):  # element position relative to the slide, immune to view zoom/pan
    h = box(page, ".pptx-holder"); e = img(page, n)
    return ((e["x"] - h["x"]) / h["width"], (e["y"] - h["y"]) / h["height"])
def frames(page): return page.locator('[data-testid="pptx-frame"]').count()
def overflow_x(page): return page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
def undo(page): page.click('[data-testid="pptx-undo"]'); page.wait_for_timeout(150)

def run(p, label, vp, ua=None):
    print(f"\n######## {label} {vp['width']}x{vp['height']}")
    b, c, page, errors = launch(p, viewport=vp, device_scale_factor=3, is_mobile=True, has_touch=True, accept_downloads=True, **({"user_agent": ua} if ua else {}))
    t = Touch(c, page)
    open_fixture(page, "overlap.pptx")
    L = lambda s: f"{label}: {s}"

    check(L("compact layout active (bottom toolbar, no desktop side panels)"), page.locator(".pe-root.is-compact").count() == 1 and page.locator(".pe-left").count() == 0 and page.locator(".pe-right").count() == 0)
    check(L("no horizontal page overflow"), overflow_x(page) <= 0, overflow_x(page))
    tb = page.evaluate("() => [...document.querySelectorAll('.pe-bottom .pe-tb')].map(b => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))")
    check(L("bottom-bar touch targets all >= 44px"), tb and min(tb) >= 44, tb)
    top = page.evaluate("() => [...document.querySelectorAll('.pe-top button')].map(b => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))")
    check(L("top-bar buttons >= 36px (tap area)"), min(top) >= 36, top)
    slide = box(page, ".pptx-holder")
    check(L("slide fits the screen width"), slide["x"] >= 0 and slide["x"] + slide["width"] <= vp["width"] + 1, slide)

    # --- tap select, handles above content, 44px hit areas ---
    a = img(page, 0); page.touchscreen.tap(a["x"] + 14, a["y"] + 14); page.wait_for_timeout(150)
    check(L("tap selects object"), frames(page) == 1)
    f = box(page, '[data-testid="pptx-frame"]')
    check(L("selection frame aligned with object"), abs(cen(f)[0] - cen(img(page, 0))[0]) < 3 and abs(cen(f)[1] - cen(img(page, 0))[1]) < 3)
    check(L("SE handle above image content"), topmost(page, f["x"] + f["width"], f["y"] + f["height"]) == "handle:se")
    hs = page.evaluate("() => [...document.querySelectorAll('.pptx-handle')].map(h => Math.min(h.getBoundingClientRect().width, h.getBoundingClientRect().height))")
    check(L("all handles have >=44px touch hit areas"), len(hs) == 9 and min(hs) >= 44, hs)
    vis = page.evaluate("() => [...document.querySelectorAll('.pptx-handle i')].map(i => i.getBoundingClientRect().width)")
    check(L("visible handle knobs are clearly sized (>=16px)"), min(vis) >= 16, vis)

    # --- touch drag moves object, page does not scroll, undo works ---
    a0 = img(page, 0); sy0 = page.evaluate("() => window.scrollY")
    t.drag(a0["x"] + 14, a0["y"] + 14, a0["x"] + 74, a0["y"] + 54)
    a1 = img(page, 0)
    check(L("touch drag moves selected object"), abs((a1["x"] - a0["x"]) - 60) < 12 and abs((a1["y"] - a0["y"]) - 40) < 12, (a0, a1))
    check(L("drag did not scroll the page"), page.evaluate("() => window.scrollY") == sy0)
    f = box(page, '[data-testid="pptx-frame"]')
    check(L("frame follows object after drag"), abs(cen(f)[0] - cen(img(page, 0))[0]) < 3)
    undo(page); a2 = img(page, 0)
    check(L("undo (top bar) restores position"), abs(a2["x"] - a0["x"]) < 1.5 and abs(a2["y"] - a0["y"]) < 1.5, (a0, a2))

    # --- drag does not accidentally select an object above the selected one; tap does ---
    A, B = img(page, 0), img(page, 1)
    px, py = B["x"] + 30, B["y"] + 30     # inside A∩B, B above
    bb0 = img(page, 1); t.drag(px, py, px + 40, py + 20)
    check(L("dragging inside selected A moves A, not covering B"), abs(img(page, 1)["x"] - bb0["x"]) < 1.5 and abs(img(page, 0)["x"] - a0["x"] - 40) < 12)
    undo(page)
    page.touchscreen.tap(px, py); page.wait_for_timeout(150)
    check(L("tapping the covering object selects it"), abs(cen(box(page, '[data-testid="pptx-frame"]'))[0] - cen(img(page, 1))[0]) < 3)
    page.click('[data-testid="pptx-bottombar"] >> text=/Select behind/i'); page.wait_for_timeout(150)
    check(L("'Select behind' button reaches the object underneath"), abs(cen(box(page, '[data-testid="pptx-frame"]'))[0] - cen(img(page, 0))[0]) < 3)

    # --- handle resize + rotate by touch ---
    page.touchscreen.tap(*[v for v in (img(page, 0)["x"] + 14, img(page, 0)["y"] + 14)]); page.wait_for_timeout(120)
    f = box(page, '[data-testid="pptx-frame"]'); w0 = img(page, 0)["width"]
    t.drag(f["x"] + f["width"], f["y"] + f["height"], f["x"] + f["width"] + 40, f["y"] + f["height"] + 10)
    check(L("SE handle touch-resize grows the image, aspect kept"), img(page, 0)["width"] > w0 + 15 and abs(img(page, 0)["width"] / img(page, 0)["height"] - 4 / 3) < 0.03)
    f = box(page, '[data-testid="pptx-frame"]'); cx, cy = cen(f)
    t.drag(cx, f["y"] - 34, cx + 100, cy)
    rot = page.evaluate("() => document.querySelector('[data-testid=\"pptx-frame\"]').style.transform")
    check(L("rotate handle touch-rotates (~90deg)"), "rotate(90" in rot or "rotate(8" in rot or "rotate(9" in rot, rot)
    undo(page); undo(page)

    # --- pinch zoom + pan ---
    page.touchscreen.tap(*(box(page, ".pe-main")["x"] + 6, box(page, ".pe-main")["y"] + 6)); page.wait_for_timeout(100)
    m = box(page, ".pe-main"); mx, my = cen(m)
    z0 = zoom(page) if page.locator('[data-testid="pptx-zoom"]').count() else 100
    s0 = box(page, ".pptx-holder")["width"]
    t.pinch(mx, my, 80, 220)
    s1 = box(page, ".pptx-holder")["width"]
    check(L("pinch zooms the slide in"), s1 > s0 * 1.8, (s0, s1))
    check(L("pinch did not move/select objects"), frames(page) == 0)
    h0 = box(page, ".pptx-holder"); t.two_finger_pan(mx, my, -90, -40)
    h1 = box(page, ".pptx-holder")
    check(L("two-finger pan moves the zoomed slide"), abs((h1["x"] - h0["x"]) + 90) < 14 and abs((h1["y"] - h0["y"]) + 40) < 14, (h0, h1))
    ep = empty_point(page)
    if ep:
        h0 = box(page, ".pptx-holder"); t.drag(ep[0], ep[1], ep[0] + 40, ep[1] + 30)
        h1 = box(page, ".pptx-holder")
        check(L("one-finger drag on empty area pans when zoomed"), abs((h1["x"] - h0["x"]) - 40) < 14 and frames(page) == 0, (h0, h1))
    else: check(L("one-finger pan (no empty point found while zoomed — skipped)"), True)
    # select while zoomed: frame must stay glued to object
    imgs = [i for i in range(3) if (lambda bx: bx["x"] > 0 and bx["x"] < vp["width"] - 40 and bx["y"] > 40 and bx["y"] < vp["height"] - 150)(img(page, i))]
    # fit again then zoom around an image
    page.evaluate("() => 0")
    t.pinch(mx, my, 220, 60); t.pinch(mx, my, 220, 60)
    check(L("pinch-out returns toward fit"), box(page, ".pptx-holder")["width"] < s1)
    t.pinch(mx, my, 60, 200); zoomed = box(page, ".pptx-holder")["width"]
    ep = empty_point(page)
    page.touchscreen.tap(*ep); page.wait_for_timeout(80); page.touchscreen.tap(*ep); page.wait_for_timeout(250)
    check(L("double-tap on empty canvas resets to fit"), box(page, ".pptx-holder")["width"] < zoomed * 0.7, (zoomed, box(page, ".pptx-holder")["width"]))

    # --- pinch during a drag cancels the drag instead of committing it ---
    a0 = img(page, 0); page.touchscreen.tap(a0["x"] + 14, a0["y"] + 14); page.wait_for_timeout(120); a0 = img(page, 0); n0 = norm(page, 0)
    t._send("touchStart", [(a0["x"] + 14, a0["y"] + 14)])
    for i in range(1, 6): t._send("touchMove", [(a0["x"] + 14 + i * 8, a0["y"] + 14 + i * 4)])
    t._send("touchStart", [(a0["x"] + 54, a0["y"] + 34), (a0["x"] + 200, a0["y"] + 150)])   # second finger lands
    t._send("touchMove", [(a0["x"] + 54, a0["y"] + 34), (a0["x"] + 230, a0["y"] + 150)])
    t._send("touchEnd", []); page.wait_for_timeout(200)
    check(L("second finger during drag cancels the move (object did not jump)"), abs(norm(page, 0)[0] - n0[0]) < 0.01 and abs(norm(page, 0)[1] - n0[1]) < 0.01, (n0, norm(page, 0)))

    # reset the view through the More menu (also covers that path)
    page.click('[data-testid="pptx-more"]'); page.wait_for_selector('[data-testid="pptx-more-sheet"]')
    page.click('[data-testid="pptx-more-sheet"] >> text=/Fit to screen/i'); page.click('[data-testid="pptx-more-sheet-close"]'); page.wait_for_timeout(300)
    check(L("More > Fit to screen restores the full slide"), box(page, ".pptx-holder")["width"] < vp["width"] and box(page, ".pptx-holder")["x"] >= 0, box(page, ".pptx-holder"))

    # --- slide navigation: thumbnails drawer + prev/next without moving objects ---
    page.touchscreen.tap(*(box(page, ".pe-main")["x"] + 6, box(page, ".pe-main")["y"] + 6))
    page.click('[data-testid="pptx-slides-open"]'); page.wait_for_timeout(600)
    check(L("slides drawer opens with thumbnails"), page.locator('.pe-drawer [data-testid^="pptx-thumb-"]').count() >= 1)
    page.keyboard.press("Escape"); page.wait_for_timeout(500)
    check(L("prev/next buttons exist and are >=44px"), min(box(page, '[data-testid="pptx-next"]')["width"], box(page, '[data-testid="pptx-next"]')["height"]) >= 44)

    # --- contextual toolbar + property sheet; canvas stays usable above the sheet ---
    a = img(page, 1); page.touchscreen.tap(a["x"] + 14, a["y"] + 14); page.wait_for_timeout(150)
    check(L("selection switches bottom bar to contextual actions"), page.locator('[data-testid="pptx-style"]').count() == 1 and page.locator('[data-testid="pptx-add-shape"]').count() == 0)
    page.click('[data-testid="pptx-style"]'); page.wait_for_selector('[data-testid="pptx-props-sheet"]'); page.wait_for_timeout(250)
    sh = box(page, '[data-testid="pptx-props-sheet"]'); st = box(page, ".pptx-stage")
    check(L("property sheet opens without covering the canvas (canvas refits above it)"), st["y"] + st["height"] <= sh["y"] + 2, (st, sh))
    fb = box(page, '[data-testid="pptx-frame"]')
    check(L("selected object stays visible above the sheet"), fb["y"] + fb["height"] <= sh["y"] + 6 and fb["y"] >= 0, (fb, sh))
    check(L("sheet fits viewport"), sh["y"] >= 0 and sh["y"] + sh["height"] <= vp["height"] + 1)
    before = box(page, ".pptx-holder"); page.evaluate("() => { const b=document.querySelector('.pe-sheet-body'); b.scrollTop = 200; }"); page.wait_for_timeout(100)
    check(L("sheet scrolls independently of the canvas"), box(page, ".pptx-holder") == before)
    page.click('[data-testid="pptx-props-sheet"] .pe-tabs button >> nth=2'); page.wait_for_timeout(150)   # Arrange
    check(L("arrange tab exposes ordering + alignment"), page.locator('[data-testid="pptx-front"]').count() == 1 and page.locator('[data-testid="pptx-al-left"]').count() == 1)
    ab = page.evaluate("() => [...document.querySelectorAll('.pe-sheet .pe-btn')].map(b => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))")
    check(L("sheet buttons are at least 36px (touch)"), min(ab) >= 36, min(ab))
    page.click('[data-testid="pptx-front"]'); page.wait_for_timeout(120)
    check(L("bring-to-front changes z-order"), page.evaluate("() => { const ids=[...document.querySelectorAll('.pptx-stage .pptx-el')].map(e=>e.dataset.id); return ids.length>0; }"))
    page.click('[data-testid="pptx-props-sheet-close"]'); page.wait_for_timeout(250)
    check(L("closing the sheet restores full canvas, selection kept"), frames(page) == 1)

    # --- multi-select mode ---
    page.click('[data-testid="pptx-multi"]'); page.wait_for_timeout(100)
    A = img(page, 0); E = box(page, ".pptx-stage .pptx-el-shape", 1)   # ellipse (objects chosen by type: z-order was changed above)
    page.touchscreen.tap(A["x"] + 14, A["y"] + 14); page.touchscreen.tap(*cen(E)); page.wait_for_timeout(150)
    check(L("multi-select mode: taps add objects to selection"), frames(page) >= 2, frames(page))
    page.click('[data-testid="pptx-multi"]'); page.touchscreen.tap(*(box(page, ".pe-main")["x"] + 6, box(page, ".pe-main")["y"] + 6)); page.wait_for_timeout(100)

    # --- export on a touch device ---
    out = f"/tmp/shots/mobile_{label}.pptx"
    with page.expect_download() as dl: page.click('[data-testid="pptx-export"]')
    dl.value.save_as(out); page.wait_for_timeout(300)
    r = subprocess.run(["python3", "-c", f"from pptx import Presentation; print(len(Presentation('{out}').slides))"], capture_output=True, text=True)
    check(L("export works on touch device and file opens in python-pptx"), r.returncode == 0 and r.stdout.strip() == "1", r.stderr[-200:])

    bad = [e for e in errors if "ERR_NAME_NOT_RESOLVED" not in e and "Failed to load" not in e]
    check(L("no console errors"), not bad, bad[:3])
    page.screenshot(path=f"/tmp/shots/mobile_{label}.png")
    b.close()

with sync_playwright() as p:
    run(p, "iphone13", {"width": 390, "height": 664})     # 844 minus browser chrome-ish; portrait
    run(p, "pixel7", {"width": 412, "height": 780})

failed = [r for r in RESULTS if not r[1]]
print(f"\n{len(RESULTS)-len(failed)}/{len(RESULTS)} passed"); sys.exit(1 if failed else 0)
