import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import es from "../messages/es.json";

const cases = [
  { locale: "es", messages: es },
  { locale: "en", messages: en },
] as const;

for (const { locale, messages } of cases) {
  test(`home page renders the header in ${locale}`, async ({ page }) => {
    const response = await page.goto(locale);
    expect(response?.ok()).toBe(true);

    await expect(page.locator("html")).toHaveAttribute("lang", locale);

    const header = page.getByRole("banner");
    await expect(header).toBeVisible();
    await expect(
      header.getByText(messages.Brand.name, { exact: true }),
    ).toBeVisible();
    await expect(
      header.getByRole("navigation", { name: messages.Header.nav }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 1, name: messages.HomePage.title }),
    ).toBeVisible();
  });

  test(`welcome page links to the design system in ${locale}`, async ({
    page,
  }) => {
    await page.goto(locale);
    await page
      .getByRole("main")
      .getByRole("link", { name: messages.HomePage.designSystem })
      .click();

    await expect(page).toHaveURL(new RegExp(`/${locale}/design-system$`));
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: messages.DesignSystemPage.title,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: messages.DesignSystemPage.components.primary,
      }),
    ).toBeVisible();
  });
}

test.describe("theme toggle", () => {
  test.use({ colorScheme: "dark" });

  test("switches to light and remembers it", async ({ page }) => {
    await page.goto("es");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "dark");

    await page
      .getByRole("banner")
      .getByRole("button", { name: es.Header.toggleTheme })
      .click();
    await expect(html).toHaveAttribute("data-theme", "light");

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "light");
  });
});
