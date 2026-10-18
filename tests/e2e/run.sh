#!/usr/bin/env bash
# Starts the Vite dev server, runs the given Playwright (python) scripts, always stops the server.
# Usage: tests/e2e/run.sh tests/e2e/desktop.py [more.py ...]
set -u
PORT=${PORT:-5199}
cd "$(dirname "$0")/../.."
npx vite --port "$PORT" --strictPort > /tmp/vite-e2e.log 2>&1 &
VITE=$!
trap 'kill $VITE 2>/dev/null' EXIT
for i in $(seq 1 40); do curl -s -m 2 -o /dev/null "http://localhost:$PORT/tests/e2e/harness/pptx.html" && break; sleep 0.5; done
status=0
for f in "$@"; do echo "=== $f"; timeout 280 python3 "$f" || status=1; done
exit $status
