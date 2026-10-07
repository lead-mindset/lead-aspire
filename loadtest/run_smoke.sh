#!/usr/bin/env bash
# Smoke test: 2 students (loadtest01 uploads, loadtest02 does not), 1 minute.
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-python}"
mkdir -p results

"$PY" -m locust -f locustfile.py --headless \
  -u 2 -r 1 -t 1m \
  --csv results/smoke --only-summary || true

"$PY" analyze.py results/smoke --users 2 --uploads 1
