import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { DallasApp } from "./_dallas/DallasApp";
import { getDallasTeamState, getDallasViewer } from "./_dallas/session";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "DallasPage" });
  return { title: t("title") };
}

/**
 * Dallas students with a team only; everyone else goes to the Dallas login.
 * The screen (?phase=…) is read by DallasApp in the browser.
 */
export default async function DallasPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await getDallasViewer();
  if (viewer.kind !== "student" || !viewer.student.team) {
    return redirect({ href: "/dallas/login", locale });
  }
  const state = await getDallasTeamState();
  if (!state) {
    const t = await getTranslations({ locale, namespace: "Dallas" });
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-24 text-center">
        <p>{t("unavailable")}</p>
        <a className="underline" href="">
          {t("retry")}
        </a>
      </main>
    );
  }
  return <DallasApp initialState={state} />;
}
