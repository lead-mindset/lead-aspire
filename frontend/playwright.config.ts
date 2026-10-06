import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { normalizeBasePath } from "./src/lib/basePath";
import { AUTH_FILE } from "./e2e/user";

// Load .env / .env.local the same way Next.js does, so BASE_PATH matches the build.
loadEnvConfig(process.cwd());
// Real e2e user (E2E_USER_EMAIL / E2E_USER_PASSWORD). See .env.test.example.
if (existsSync(".env.test")) process.loadEnvFile(".env.test");

const PORT = Number(process.env.PORT ?? 3000);
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH);
const PYTHON =
  process.platform === "win32" ? ".venv\\Scripts\\python.exe" : ".venv/bin/python";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    // Trailing slash so page.goto("es") resolves to <base path>/es.
    baseURL: `http://localhost:${PORT}${BASE_PATH}/`,
    trace: "on-first-retry",
  },
  projects: [
    // Pages that need no session.
    {
      name: "public",
      testMatch: /(smoke|login)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Signs the real user in once and saves the session for the next projects.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "signed-in",
      testMatch: /new-york\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
    },
    // Last: Supabase sign-out revokes every session of the user.
    {
      name: "sign-out",
      testMatch: /sign-out\.spec\.ts/,
      dependencies: ["signed-in"],
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
    },
  ],
  webServer: [
    {
      // FastAPI backend used by the login form and the New York app.
      command: `${PYTHON} -m uvicorn app.main:app --port 8000`,
      cwd: "../backend",
      url: "http://localhost:8000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npm run build && npm run start -- -p ${PORT}`,
      url: `http://localhost:${PORT}${BASE_PATH}/es`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
