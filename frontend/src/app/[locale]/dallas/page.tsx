import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DallasApp } from "./_dallas/DallasApp";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "DallasPage" });
  return { title: t("title") };
}

export default async function DallasPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DallasApp />;
}
