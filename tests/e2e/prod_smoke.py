"""Core flow against the MINIFIED production bundle (HARNESS_URL points at the built harness)."""
import sys, os, subprocess; sys.path.insert(0, os.path.dirname(__file__))
from common import *
R = []
def check(n, ok, d=""): R.append(ok); print("PASS" if ok else "FAIL", "-", n, "" if ok else d)
with sync_playwright() as p:
    for label, kw in [("desktop", dict(viewport={"width": 1440, "height": 900})), ("phone", dict(viewport={"width": 390, "height": 664}, device_scale_factor=2, is_mobile=True, has_touch=True))]:
        b, c, page, errors = launch(p, accept_downloads=True, **kw)
        open_fixture(page, "overlap.pptx")
        n = page.locator(".pptx-stage .pptx-el").count(); check(f"prod/{label}: renders 7 objects", n == 7, n)
        a = page.locator(".pptx-stage .pptx-el-image").first.bounding_box()
        (page.mouse.click if label == "desktop" else page.touchscreen.tap)(a["x"] + 14, a["y"] + 14); page.wait_for_timeout(200)
        check(f"prod/{label}: selection frame + handles present", page.locator('[data-testid="pptx-frame"] .pptx-handle').count() == 9)
        out = f"/tmp/shots/prod_{label}.pptx"
        with page.expect_download() as dl: page.click('[data-testid="pptx-export"]')
        dl.value.save_as(out)
        r = subprocess.run(["python3", "-c", f"from pptx import Presentation; print(len(Presentation('{out}').slides))"], capture_output=True, text=True)
        check(f"prod/{label}: exported file opens in python-pptx", r.stdout.strip() == "1", r.stderr[-150:])
        bad = [e for e in errors if "ERR_NAME_NOT_RESOLVED" not in e and "Failed to load" not in e]
        check(f"prod/{label}: no console errors", not bad, bad[:2]); b.close()
print(f"{sum(R)}/{len(R)} passed"); sys.exit(0 if all(R) else 1)
