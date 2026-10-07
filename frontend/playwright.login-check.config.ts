import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// `npm run check:logins`: signs in every email in e2e/login-check-emails.txt.
// Same servers and base URL as the e2e suite, but only the login check runs.
export default defineConfig({
  ...base,
  // Few parallel logins: Supabase rate-limits sign-ins. Override with --workers.
  workers: 2,
  use: {
    ...base.use,
    // Slow machines (or `next dev` compiling a page) need more time.
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
  },
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  projects: [
    {
      name: "login-check",
      testMatch: /login-check\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
