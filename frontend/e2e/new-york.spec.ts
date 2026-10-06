import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { e2eUser } from "./user";

// Read-only checks: nothing here marks progress, submits a deck or asks the
// coach, so the real user's team data is never changed.

const PHASES = ["discover", "strategize", "build", "pitch"] as const;
const t = en.Aspire;

test("home shows the signed-in user and the journey", async ({ page }) => {
  await page.goto("en/new-york");

  await expect(page.getByText(e2eUser().email)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(t.home.titleFirst);
  await expect(page.getByRole("heading", { name: t.progress.title })).toBeVisible();
  await expect(page.getByRole("button", { name: t.user.signOut })).toBeVisible();
});

test("the sidebar links to every phase", async ({ page }) => {
  await page.goto("en/new-york");
  const nav = page.getByRole("navigation", { name: t.nav.label });

  for (const phase of PHASES) {
    await nav.getByRole("link", { name: t.phases[phase].title }).click();
    await expect(page).toHaveURL(new RegExp(`/new-york/${phase}$`));
    await expect(page.getByRole("heading", { level: 1, name: t.phases[phase].title })).toBeVisible();
    await expect(nav.getByRole("link", { name: t.phases[phase].title })).toHaveAttribute("aria-current", "page");
  }
});

test("an unknown phase is not found", async ({ page }) => {
  const response = await page.goto("en/new-york/party");
  expect(response?.status()).toBe(404);
});

test("a phase guide opens in the document viewer", async ({ page }) => {
  await page.goto("en/new-york/discover");

  await page.getByRole("button", { name: t.docs.discovery.action }).click();
  const viewer = page.getByRole("dialog", { name: t.docs.discovery.title });
  await expect(viewer).toBeVisible();
  await expect(viewer.locator("iframe")).toHaveAttribute("src", /discovery\.pdf$/);

  await viewer.getByRole("button", { name: t.viewer.back }).click();
  await expect(viewer).toBeHidden();
});

// Same switch as src/lib/features.ts; playwright.config.ts loads .env like Next does.
const COACH_ENABLED = process.env.NEXT_PUBLIC_COACH_ENABLED === "true";

test("without the coach, the launcher is gone and Ask the coach is disabled", async ({ page }) => {
  test.skip(COACH_ENABLED, "NEXT_PUBLIC_COACH_ENABLED is true");
  await page.goto("en/new-york");

  // Both buttons read "Ask the coach"; only the floating launcher has aria-expanded.
  await expect(page.getByRole("button", { name: t.coach.open, expanded: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: t.help.ask })).toBeDisabled();
});

test("the coach opens and closes without sending anything", async ({ page }) => {
  test.skip(!COACH_ENABLED, "NEXT_PUBLIC_COACH_ENABLED is not true");
  await page.goto("en/new-york");

  // The floating launcher; the help card has a second "Ask the coach" button.
  await page.getByRole("button", { name: t.coach.open, expanded: false }).click();
  const coach = page.getByRole("region", { name: t.coach.title });
  await expect(coach).toBeVisible();
  await expect(coach.getByLabel(t.coach.inputLabel)).toBeVisible();

  await coach.getByRole("button", { name: t.coach.close }).click();
  await expect(coach).toBeHidden();
});

test("the app is translated to Spanish", async ({ page }) => {
  await page.goto("es/new-york");

  await expect(page.getByRole("button", { name: es.Aspire.user.signOut })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: es.Aspire.nav.label }).getByRole("link", { name: es.Aspire.nav.home }),
  ).toBeVisible();
});
