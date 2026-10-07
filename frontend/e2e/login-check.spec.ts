import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page, type Response } from "@playwright/test";
import en from "../messages/en.json";

// Checks that every email in the list can sign in with the shared password.
// Run with `npm run check:logins`; it is not part of `npm run test:e2e`.
//
//   e2e/login-check-emails.txt  one email per line, # for comments (gitignored)
//   LOGIN_CHECK_PASSWORD        the shared password, in .env.test
//   LOGIN_CHECK_FILE            optional: read the emails from another file
//   LOGIN_CHECK_DELAY_MS        optional: pause before each login (pacing)
//
// Each email signs in once in its own browser context. Nothing signs out:
// Supabase sign-out would revoke every session of that user.
//
// Every login signs in to Supabase twice (backend, then browser), so a long
// list can hit Supabase's sign-in rate limit; rate-limited attempts (429)
// wait and retry. Note the backend reports every Supabase sign-in error,
// a rate limit included, as 401 "Invalid email or password".

const FILE = process.env.LOGIN_CHECK_FILE ?? "e2e/login-check-emails.txt";
const DELAY_MS = Number(process.env.LOGIN_CHECK_DELAY_MS ?? 0);
const WAIT_MS = 60_000;
const RATE_LIMIT_RETRIES = 4;
const t = en.LoginPage;

function readEmails(): string[] {
  if (!existsSync(FILE)) {
    throw new Error(
      `Create ${FILE} with one email per line (see e2e/login-check-emails.example.txt).`,
    );
  }
  const emails = readFileSync(FILE, "utf8")
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(emails)];
}

function sharedPassword(): string {
  const password = process.env.LOGIN_CHECK_PASSWORD;
  if (!password) {
    throw new Error("Set LOGIN_CHECK_PASSWORD in frontend/.env.test.");
  }
  return password;
}

type Attempt =
  | { ok: true; home: string }
  | { ok: false; reason: string; status?: number; rateLimited: boolean };

/** Status and readable message of a failed auth response. */
async function describe(response: Response, source: string) {
  const text = await response.text().catch(() => "");
  let message = text;
  try {
    const body = JSON.parse(text);
    const detail = body.detail ?? body.error ?? body.msg ?? body.message;
    message = typeof detail === "string" ? detail : (detail?.message ?? text);
  } catch {
    // Not JSON: keep the raw text.
  }
  const status = response.status();
  return {
    status,
    reason: `${source} ${status}: ${message || response.statusText()}`,
    rateLimited: status === 429 || /rate.?limit|too many/i.test(message),
  };
}

async function attemptLogin(page: Page, email: string): Promise<Attempt> {
  // Auth responses seen during this attempt: the backend login and the
  // browser's own Supabase sign-in (/auth/v1/token).
  const responses: Promise<Response>[] = [];
  const onResponse = (response: Response) => {
    const url = response.url();
    if (url.includes("/api/auth/login") || url.includes("/auth/v1/token")) {
      responses.push(Promise.resolve(response));
    }
  };
  page.on("response", onResponse);

  try {
    await page.goto("en/login", { timeout: WAIT_MS });
    await page.getByLabel(t.emailLabel).fill(email);
    await page
      .getByLabel(t.passwordLabel, { exact: true })
      .fill(sharedPassword());
    await page.getByRole("button", { name: t.submit }).click();

    // Signed in: the form sends the user to their city home.
    // Rejected: the form shows its alert (scoped to the form, so Next's
    // route announcer, also role="alert", is ignored).
    const alert = page.locator("form").getByRole("alert");
    const outcome = await Promise.race([
      page.waitForURL(/\/(new-york|dallas)$/, { timeout: WAIT_MS }).then(
        () => "ok" as const,
        () => "timeout" as const,
      ),
      alert.waitFor({ timeout: WAIT_MS }).then(
        () => "error" as const,
        () => "timeout" as const,
      ),
    ]);

    if (outcome === "ok") {
      return { ok: true, home: new URL(page.url()).pathname };
    }

    // The form shows one generic message for most failures; the responses
    // carry the real reason.
    for (const response of await Promise.all(responses)) {
      if (response.status() >= 400) {
        const source = response.url().includes("/api/auth/login")
          ? "Backend"
          : "Supabase";
        return { ok: false, ...(await describe(response, source)) };
      }
    }
    if (outcome === "error") {
      const message = (await alert.innerText()).trim();
      return {
        ok: false,
        reason: `Login form: ${message}`,
        rateLimited: /rate.?limit|too many/i.test(message),
      };
    }
    return {
      ok: false,
      reason: `No redirect or error after ${WAIT_MS / 1000}s (still on ${page.url()})`,
      rateLimited: false,
    };
  } finally {
    page.off("response", onResponse);
  }
}

const emails = readEmails();

test("the email list is not empty", () => {
  expect(emails.length, `${FILE} has no emails`).toBeGreaterThan(0);
});

for (const email of emails) {
  test(email, async ({ page }) => {
    test.setTimeout(10 * 60_000);
    if (DELAY_MS > 0) await page.waitForTimeout(DELAY_MS);

    for (let retries = 0; ; retries++) {
      const attempt = await attemptLogin(page, email);
      if (attempt.ok) {
        test
          .info()
          .annotations.push({ type: "home", description: attempt.home });
        console.log(`${email} → ${attempt.home}`);
        return;
      }

      if (!attempt.rateLimited || retries >= RATE_LIMIT_RETRIES) {
        throw new Error(attempt.reason);
      }
      // Back off longer each time, with jitter so workers don't retry together.
      const waitMs = 60_000 * (retries + 1) + Math.random() * 10_000;
      console.log(
        `${email}: ${attempt.reason} — retrying in ${Math.round(waitMs / 1000)}s`,
      );
      await page.waitForTimeout(waitMs);
    }
  });
}
