import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LabShell } from "./_nyc/LabShell";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "NycSchools" });
  return { title: t("title") };
}

// NYC Schools Copilot Executive Lab: public, no sign-in. Progress is kept in
// the browser (see _nyc/progress.ts).
export default async function NycSchoolsLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LabShell>{children}</LabShell>;
}
