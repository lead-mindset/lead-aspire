import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { DallasApp } from "./_dallas/DallasApp";
import { getDallasViewer } from "./_dallas/session";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "DallasPage" });
  return { title: t("title") };
}

/** Dallas students with a team only; everyone else goes to the Dallas login. */
export default async function DallasPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await getDallasViewer();
  if (viewer.kind !== "student" || !viewer.student.team) {
    return redirect({ href: "/dallas/login", locale });
  }
  return <DallasApp student={viewer.student} team={viewer.student.team} />;
}
