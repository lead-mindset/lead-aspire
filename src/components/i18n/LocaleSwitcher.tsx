"use client";

import { useLocale, useTranslations } from "next-intl";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <SegmentedControl
      label={t("label")}
      value={locale}
      onChange={(next) => router.replace(pathname, { locale: next as Locale })}
      options={routing.locales.map((code) => ({
        value: code,
        label: (
          <abbr title={t(code)} lang={code} className="no-underline">
            {code.toUpperCase()}
          </abbr>
        ),
      }))}
    />
  );
}
