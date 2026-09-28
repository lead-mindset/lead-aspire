import Image from "next/image";
import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { withBasePath } from "@/lib/basePath";
import { CityPicker } from "./CityPicker";

type Props = {
  params: Promise<{ locale: string }>;
};

export default function AspireHomePage({ params }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("AspireHomePage");

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-[1200px] flex-col items-center justify-center gap-7 px-4 py-7 sm:py-8">
      <h1 className="sr-only">{t("title")}</h1>
      <Image
        src={withBasePath("/lead-aspire-logo.png")}
        alt={t("logoAlt")}
        width={1967}
        height={800}
        priority
        className="h-auto w-64 sm:w-80"
      />
      <CityPicker />
    </section>
  );
}
