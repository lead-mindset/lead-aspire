/** The real e2e user from .env.test; fails with a clear message when missing. */
export function e2eUser() {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set E2E_USER_EMAIL and E2E_USER_PASSWORD in frontend/.env.test (see .env.test.example).",
    );
  }
  return { email, password };
}

export const AUTH_FILE = "e2e/.auth/user.json";
