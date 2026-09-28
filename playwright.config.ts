import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { normalizeBasePath } from "./src/lib/basePath";

// Load .env / .env.local the same way Next.js does, so BASE_PATH matches the build.
loadEnvConfig(process.cwd());

const PORT = Number(process.env.PORT ?? 3000);
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH);

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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}${BASE_PATH}/es`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
