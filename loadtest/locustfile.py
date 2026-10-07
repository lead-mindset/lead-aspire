"""LEAD Aspire event load test: 90 students log in, 18 teams upload their deck.

Each simulated student (one row of test_users.csv, never shared):
  1. login_backend   POST /api/auth/login                    (like the login form)
  2. login_supabase  POST {SUPABASE_URL}/auth/v1/token        (the browser's own sign-in; keeps the token)
  3. App load        GET /api/team/progress, members, submission
  4. Upload, only the first member of each group:
       upload_url      POST /api/team/submission/upload-url
       storage_upload  PUT  {SUPABASE_URL}/storage/v1/object/upload/sign/...  (~2 MB PDF)
       upload_confirm  POST /api/team/submission/confirm
  5. Idle: idle_progress (GET /api/team/progress) every 10-20 s until the run ends.

UPLOAD_AT (epoch seconds) makes every uploader wait for that moment, so the
18 uploads start together (run_upload_burst.sh). Without it they upload right
after login (run_login_burst.sh).

Besides Locust's CSVs, every request (idle_progress only when it fails) goes to
<csv prefix>_flow.csv, with response headers for 429s, 5xx and failures.
analyze.py reads both.
"""

import csv
import json
import os
import threading
import time
from pathlib import Path
from urllib.parse import quote

import gevent
from dotenv import load_dotenv
from locust import HttpUser, between, events, task

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
PASSWORD = os.environ.get("LOADTEST_PASSWORD", "")
HOST = os.environ.get("LOADTEST_HOST", "").rstrip("/")
UPLOAD_AT = float(os.environ["UPLOAD_AT"]) if os.environ.get("UPLOAD_AT") else None
CITY = "NYC"
PDF_BYTES = 2 * 1024 * 1024

for name, value in [("SUPABASE_URL", SUPABASE_URL), ("SUPABASE_ANON_KEY", ANON_KEY),
                    ("LOADTEST_PASSWORD", PASSWORD), ("LOADTEST_HOST", HOST)]:
    if not value:
        raise SystemExit(f"Set {name} in loadtest/.env (see .env.example).")


def make_pdf(padding: int) -> bytes:
    """A valid one-page PDF padded with an unreferenced binary stream to ~`padding` bytes.

    Random bytes do not compress, so the upload size matches a real deck.
    """
    text = b"BT /F1 24 Tf 72 720 Td (LEAD Aspire load test deck) Tj ET"
    blob = os.urandom(padding)
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(text) + text + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length %d >>\nstream\n" % len(blob) + blob + b"\nendstream",
    ]
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % number + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(out)


PDF = make_pdf(PDF_BYTES)


def load_users() -> list[dict]:
    path = HERE / "test_users.csv"
    if not path.exists():
        raise SystemExit("test_users.csv is missing: run create_test_users.py first.")
    with path.open(newline="") as file:
        return list(csv.DictReader(file))


USERS = load_users()
_next_user = iter(USERS)

# ---------- Flow log (<csv prefix>_flow.csv) ----------

FLOW_FIELDS = ["time", "name", "email", "group_code", "status", "ms", "ok", "origin", "error", "headers", "body"]
_flow_lock = threading.Lock()
_flow = {"writer": None, "file": None}


@events.init.add_listener
def _open_flow_log(environment, **_):
    prefix = getattr(environment.parsed_options, "csv_prefix", None) or "results/run"
    path = HERE / f"{prefix}_flow.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    _flow["file"] = path.open("w", newline="", encoding="utf-8")
    _flow["writer"] = csv.DictWriter(_flow["file"], fieldnames=FLOW_FIELDS)
    _flow["writer"].writeheader()


@events.quitting.add_listener
def _close_flow_log(**_):
    if _flow["file"]:
        _flow["file"].close()


def log_flow(name, user, status, ms, ok, error="", response=None, url=""):
    writer = _flow["writer"]
    if writer is None:
        return
    keep_details = response is not None and (not ok or status == 429 or status >= 500)
    row = {
        "time": f"{time.time():.3f}",
        "name": name,
        "email": user["email"],
        "group_code": user["group_code"],
        "status": status,
        "ms": round(ms),
        "ok": int(ok),
        "origin": "supabase" if url.startswith(SUPABASE_URL) else "backend",
        "error": error,
        "headers": json.dumps(dict(response.headers)) if keep_details else "",
        "body": (response.text or "")[:500] if keep_details else "",
    }
    with _flow_lock:
        writer.writerow(row)
        _flow["file"].flush()


def fire_flow_stat(environment, name, started, error=None):
    """Adds a FLOW row to Locust's stats for a multi-request step (e.g. the full upload)."""
    environment.events.request.fire(
        request_type="FLOW",
        name=name,
        response_time=(time.perf_counter() - started) * 1000,
        response_length=0,
        exception=error,
        context={},
    )


class Student(HttpUser):
    host = HOST
    wait_time = between(10, 20)

    def call(self, method, url, name, expect=(200,), log_all=True, **kwargs):
        """One named request: marks non-`expect` statuses as failures (with the email).

        Logged to the flow CSV always, or only when it fails if `log_all` is False.
        """
        started = time.perf_counter()
        with self.client.request(method, url, name=name, catch_response=True, **kwargs) as response:
            ms = (time.perf_counter() - started) * 1000
            ok = response.status_code in expect
            error = ""
            if not ok:
                detail = (response.text or "")[:200].replace("\n", " ")
                error = f"{self.account['email']} -> {response.status_code}: {detail or response.reason}"
                response.failure(error)
            else:
                response.success()
            if log_all or not ok or response.status_code == 429 or response.status_code >= 500:
                log_flow(name, self.account, response.status_code, ms, ok, error, response, url)
            return response, ok

    def api_headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    # A student whose login failed stays connected but idle (see idle_progress)
    # instead of stopping: Locust replaces stopped users during the ramp-up,
    # and the replacements would use up the remaining test accounts.

    def on_start(self):
        self.token = None
        self.account = next(_next_user, None)
        if self.account is None:
            print("More Locust users than test accounts: this one stays idle")
            return

        # 1. Backend login (city/group check + login event), like the login form.
        login_started = time.perf_counter()
        _, ok = self.call(
            "POST", "/api/auth/login", "login_backend",
            json={"email": self.account["email"], "password": PASSWORD},
        )
        if not ok:
            return

        # 2. The browser's own Supabase sign-in; its token authorizes every API call.
        response, ok = self.call(
            "POST", f"{SUPABASE_URL}/auth/v1/token?grant_type=password", "login_supabase",
            json={"email": self.account["email"], "password": PASSWORD},
            headers={"apikey": ANON_KEY},
        )
        if not ok:
            return
        self.token = response.json().get("access_token")
        fire_flow_stat(self.environment, "login_total", login_started)

        # 3. App load: the New York app's three parallel requests.
        greenlets = [
            gevent.spawn(self.call, "GET", f"/api/team/{route}?city_code={CITY}", f"GET /api/team/{route}",
                         headers=self.api_headers())
            for route in ("progress", "members", "submission")
        ]
        gevent.joinall(greenlets)

        # 4. Upload: first member of each group only.
        if self.account["uploader"] == "1":
            if UPLOAD_AT is not None:
                late = time.time() - UPLOAD_AT
                if late < 0:
                    gevent.sleep(-late)
                elif late > 1:
                    print(f"{self.account['email']}: logged in {late:.1f}s after UPLOAD_AT, uploading late")
            self.upload()

    def upload(self):
        started = time.perf_counter()
        group = self.account["group_code"]
        file_name = f"loadtest-{group}.pdf"

        response, ok = self.call(
            "POST", f"/api/team/submission/upload-url?city_code={CITY}", "upload_url",
            json={"file_name": file_name, "size": len(PDF), "content_type": "application/pdf"},
            headers=self.api_headers(),
        )
        if not ok:
            fire_flow_stat(self.environment, "upload_total", started, Exception("upload_url failed"))
            return
        permission = response.json()

        # Same request supabase-js uploadToSignedUrl makes, with the raw file body.
        upload_url = (
            f"{SUPABASE_URL}/storage/v1/object/upload/sign/{permission['bucket']}/"
            f"{quote(permission['path'], safe='/')}?token={quote(permission['token'])}"
        )
        _, ok = self.call(
            "PUT", upload_url, "storage_upload",
            data=PDF,
            headers={
                "apikey": ANON_KEY,
                "Authorization": f"Bearer {self.token}",
                "Content-Type": permission["content_type"],
                "cache-control": "max-age=3600",
                "x-upsert": "false",
            },
        )
        if not ok:
            fire_flow_stat(self.environment, "upload_total", started, Exception("storage_upload failed"))
            return

        _, ok = self.call(
            "POST", f"/api/team/submission/confirm?city_code={CITY}", "upload_confirm",
            json={"path": permission["path"], "file_name": file_name, "demo_link": None},
            headers=self.api_headers(),
        )
        fire_flow_stat(self.environment, "upload_total", started, None if ok else Exception("upload_confirm failed"))

    @task
    def idle_progress(self):
        if not self.token:
            gevent.sleep(3600)  # Login failed: send nothing until the run ends.
            return
        self.call("GET", f"/api/team/progress?city_code={CITY}", "idle_progress",
                  headers=self.api_headers(), log_all=False)
