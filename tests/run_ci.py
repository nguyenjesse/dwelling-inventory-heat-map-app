#!/usr/bin/env python3
"""Run the in-browser test suite headless and exit non-zero on any failure.

The suite (app/tests/tests.html) is ES modules + fetch, so it must be served
over HTTP, not opened from file://. This script serves app/ on a local port,
drives headless Chromium via Playwright to open the test page, waits for the
runner's machine-readable signal (window.__TEST_RESULT__, set at the end of
tests.js), prints the summary, and returns a shell-friendly exit code.

Usage:  python3 tests/run_ci.py
Requires: playwright (pip install playwright && playwright install chromium)
"""

import functools
import http.server
import socket
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
TIMEOUT_MS = 30_000


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> int:
    port = _free_port()
    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler, directory=str(APP))
    # Quiet the per-request logging.
    handler.log_message = lambda *a, **k: None  # type: ignore[assignment]
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    url = f"http://127.0.0.1:{port}/tests/tests.html"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(url, wait_until="load")
            try:
                page.wait_for_function("window.__TEST_RESULT__", timeout=TIMEOUT_MS)
            except Exception:
                print("ERROR: test suite never reported a result "
                      f"(window.__TEST_RESULT__ unset within {TIMEOUT_MS} ms).")
                for e in errors:
                    print("  page error:", e)
                browser.close()
                return 1
            result = page.evaluate("window.__TEST_RESULT__")
            browser.close()
    finally:
        server.shutdown()

    passed, failed, total = result["passed"], result["failed"], result["total"]
    print(f"{passed}/{total} passed" + (f" — {failed} FAILED" if failed else " — all green"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
