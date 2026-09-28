"use client";

import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";

export function CityPicker() {
  const t = useTranslations("AspireHomePage");
  const cityClasses = buttonClasses({
    variant: "secondary",
    size: "lg",
    className: "flex-1",
  });

  return (
    <nav
      aria-label={t("cityLabel")}
      className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
    >
      <Link href="/new-york" className={cityClasses}>
        {t("newYork")}
      </Link>
      <Link href="/dallas" className={cityClasses}>
        {t("dallas")}
      </Link>
    </nav>
  );
}
