#!/usr/bin/env bash
# Submission deadline: 90 students log in over 60 s (1.5/s), then all 18
# uploads start at the same moment (UPLOAD_AT, 75 s after start). 4 minutes.
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-python}"
mkdir -p results

# 60 s of spawning + 15 s for the last logins to finish.
export UPLOAD_AT=$(( $(date +%s) + 75 ))
echo "Uploads start at $(date -d "@$UPLOAD_AT" +%T 2>/dev/null || echo "epoch $UPLOAD_AT")"

"$PY" -m locust -f locustfile.py --headless \
  -u 90 -r 1.5 -t 4m \
  --csv results/upload_burst --only-summary || true

"$PY" analyze.py results/upload_burst --users 90 --uploads 18
