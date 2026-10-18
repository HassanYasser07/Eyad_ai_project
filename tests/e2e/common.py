"""Shared Playwright helpers. Uses a locally cached Chromium (set CHROME_PATH). Emulation only —
this is NOT an Android/iOS WebView and NOT a physical device."""
import os, glob
from playwright.sync_api import sync_playwright
URL = os.environ.get("HARNESS_URL", "http://localhost:5199/tests/e2e/harness/pptx.html")
CHROME = os.environ.get("CHROME_PATH") or (glob.glob(os.path.expanduser("~/.cache/puppeteer/chrome/*/chrome-linux64/chrome")) or [None])[0]
FIX = os.path.join(os.path.dirname(__file__), "..", "pptx", "fixtures")

def launch(p, **ctx):
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--disable-gpu"])
    c = b.new_context(**ctx)
    page = c.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"PAGEERROR {e}"))
    return b, c, page, errors

def open_fixture(page, name):
    page.goto(URL); page.wait_for_selector('[data-testid="pptx-open"]')
    with page.expect_file_chooser() as fc:
        page.click('[data-testid="pptx-open"]')
    fc.value.set_files(os.path.join(FIX, name))
    page.wait_for_selector('[data-testid="pptx-overlay"]')
    page.wait_for_timeout(400)
