import { expect, test } from "@playwright/test";
import en from "../messages/en.json";

test("signing out returns to login and locks the app", async ({ page }) => {
  await page.goto("en/new-york");

  await page.getByRole("button", { name: en.Aspire.user.signOut }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("en/new-york");
  await expect(page).toHaveURL(/\/login$/);
});
