import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import es from "../messages/es.json";

const cases = [
  { locale: "es", messages: es },
  { locale: "en", messages: en },
] as const;

for (const { locale, messages } of cases) {
  const m = messages.NycSchools;

  test(`NYC Schools lab opens without signing in, in ${locale}`, async ({
    page,
  }) => {
    await page.goto(`${locale}/nycschools`);
    await expect(page).toHaveURL(/\/nycschools$/);
    await expect(
      page.getByRole("heading", { level: 1, name: m.home.title }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: m.setup.open }),
    ).toHaveAttribute("href", /m365\.cloud\.microsoft\/chat/);
  });

  test(`NYC Schools lab walks through every step in ${locale}`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`${locale}/nycschools`);
    await page.getByRole("link", { name: m.home.start }).click();

    await expect(page).toHaveURL(/\/nycschools\/discover$/);
    await expect(
      page.getByRole("heading", { level: 1, name: m.steps.discover.title }),
    ).toBeVisible();

    // Copying a prompt puts the English prompt on the clipboard.
    await page
      .getByRole("region", { name: m.prompts.analyze })
      .getByRole("button", { name: m.copy })
      .click();
    await expect(page.getByRole("button", { name: m.copied })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      "Act as an operations advisor",
    );

    // Marking a step done celebrates (25%) and offers the next step.
    await page.getByRole("button", { name: m.done.mark }).click();
    const celebration = page.getByRole("dialog");
    await expect(celebration).toContainText(
      m.celebrate.title.replace("{step}", m.steps.discover.title),
    );
    await expect(celebration).toContainText("25%");
    await celebration
      .getByRole("button", {
        name: m.done.next.replace("{step}", m.steps.explore.title),
      })
      .click();
    await expect(page).toHaveURL(/\/nycschools\/explore$/);
    await expect(celebration).toHaveCount(0);

    // The role picker rewrites the recommend prompt.
    await page
      .getByLabel(m.roles.label)
      .selectOption({ label: m.roles.options.compliance });
    await expect(
      page.getByRole("region", { name: m.prompts.recommend }),
    ).toContainText("Compliance, Policy & Equal Opportunity function");

    // Progress survives a reload (stored in the browser).
    await page.reload();
    await expect(
      page.getByRole("link", { name: m.steps.discover.title }),
    ).toContainText("✓");
  });
}
