import { expect, test as setup } from "@playwright/test";
import en from "../messages/en.json";
import { AUTH_FILE, e2eUser } from "./user";

setup("sign in with the e2e user", async ({ page }) => {
  const { email, password } = e2eUser();
  const t = en.LoginPage;

  await page.goto("en/login");
  await page.getByLabel(t.emailLabel).fill(email);
  await page.getByLabel(t.passwordLabel, { exact: true }).fill(password);
  await page.getByRole("button", { name: t.submit }).click();

  await expect(page).toHaveURL(/\/(new-york|dashboard)$/, { timeout: 30_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
