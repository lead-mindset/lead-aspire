import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { e2eUser } from "./user";

const cases = [
  { locale: "en", messages: en },
  { locale: "es", messages: es },
] as const;

for (const { locale, messages } of cases) {
  const t = messages.LoginPage;

  test(`login page shows the sign-in form in ${locale}`, async ({ page }) => {
    await page.goto(`${locale}/login`);

    await expect(page.getByRole("heading", { name: t.welcome })).toBeVisible();
    await expect(page.getByLabel(t.emailLabel)).toBeVisible();
    await expect(page.getByLabel(t.passwordLabel, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: t.submit })).toBeEnabled();
  });

  for (const path of ["new-york", "new-york/discover", "dashboard"]) {
    test(`signed-out visitors to /${path} go to login in ${locale}`, async ({ page }) => {
      await page.goto(`${locale}/${path}`);
      // localePrefix is "never": the locale lives in a cookie, not the URL.
      await expect(page).toHaveURL(/\/login$/);
    });
  }
}

test("show/hide toggles the password visibility", async ({ page }) => {
  const t = en.LoginPage;
  await page.goto("en/login");
  const password = page.getByLabel(t.passwordLabel, { exact: true });

  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: t.showPassword }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: t.hidePassword }).click();
  await expect(password).toHaveAttribute("type", "password");
});

test("a wrong password shows an error and stays on login", async ({ page }) => {
  const t = en.LoginPage;
  await page.goto("en/login");

  await page.getByLabel(t.emailLabel).fill(e2eUser().email);
  await page.getByLabel(t.passwordLabel, { exact: true }).fill("definitely-not-the-password");
  await page.getByRole("button", { name: t.submit }).click();

  await expect(page.getByRole("alert").filter({ hasText: t.error })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
