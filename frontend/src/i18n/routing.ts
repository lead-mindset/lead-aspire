import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "es",
  localePrefix: "never",
});

export type Locale = (typeof routing.locales)[number];
