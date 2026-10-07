#!/usr/bin/env bash
# Worst case: all 90 students log in within 30 s (3/s); the 18 uploaders
# upload right after logging in. 3 minutes.
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-python}"
mkdir -p results

"$PY" -m locust -f locustfile.py --headless \
  -u 90 -r 3 -t 3m \
  --csv results/login_burst --only-summary || true

"$PY" analyze.py results/login_burst --users 90 --uploads 18
