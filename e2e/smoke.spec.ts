import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import es from "../messages/es.json";

const cases = [
  { locale: "es", messages: es },
  { locale: "en", messages: en },
] as const;

for (const { locale, messages } of cases) {
  test(`home page renders in ${locale}`, async ({ page }) => {
    const response = await page.goto(locale);
    expect(response?.ok()).toBe(true);

    await expect(page.locator("html")).toHaveAttribute("lang", locale);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: messages.AspireHomePage.title,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: messages.AspireHomePage.logoAlt }),
    ).toBeVisible();
  });

  test(`New York opens its page in ${locale}`, async ({ page }) => {
    await page.goto(locale);
    const cities = page.getByRole("navigation", {
      name: messages.AspireHomePage.cityLabel,
    });

    await cities
      .getByRole("link", { name: messages.AspireHomePage.newYork })
      .click();

    await expect(page).toHaveURL(new RegExp(`/${locale}/new-york$`));
    await expect(
      page.getByRole("heading", { level: 1, name: messages.NewYorkPage.title }),
    ).toBeVisible();

    await page
      .getByRole("main")
      .getByRole("link", { name: messages.NewYorkPage.back })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}$`));
  });

  test(`New York guide lists the steps in ${locale}`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`${locale}/new-york`);
    const main = page.getByRole("main");
    await main
      .getByLabel(messages.NewYorkPage.gate.label)
      .fill("student@school.edu");
    await main
      .getByRole("button", { name: messages.NewYorkPage.gate.submit })
      .click();

    await expect(main.getByRole("heading", { level: 2 })).toHaveText([
      messages.NewYorkPage.parts.foundry,
      messages.NewYorkPage.parts.agent,
    ]);
    await expect(main.getByRole("heading", { level: 3 })).toHaveCount(10);
    await expect(
      main.getByRole("link", {
        name: messages.NewYorkPage.steps.portal.link,
      }),
    ).toHaveAttribute("href", /azure\.microsoft\.com/);

    await main.getByRole("button", { name: messages.NewYorkPage.copy }).click();
    await expect(
      main.getByRole("button", { name: messages.NewYorkPage.copied }),
    ).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("You are a Fraud Investigation Assistant.");
  });

  test(`New York guide is locked until an email is entered in ${locale}`, async ({
    page,
  }) => {
    const { gate, parts } = messages.NewYorkPage;
    await page.goto(`${locale}/new-york`);
    const main = page.getByRole("main");
    const email = main.getByLabel(gate.label);
    const unlock = main.getByRole("button", { name: gate.submit });

    await expect(
      main.getByRole("heading", { name: parts.foundry }),
    ).toHaveCount(0);

    await email.fill("not-an-email");
    await unlock.click();
    await expect(main.getByText(gate.error)).toBeVisible();
    await expect(
      main.getByRole("heading", { name: parts.foundry }),
    ).toHaveCount(0);

    await email.fill("student@school.edu");
    await unlock.click();
    await expect(
      main.getByRole("heading", { name: parts.foundry }),
    ).toBeVisible();
    await expect(email).toHaveCount(0);

    await page.reload();
    await expect(
      main.getByRole("heading", { name: parts.foundry }),
    ).toBeVisible();
  });
}
