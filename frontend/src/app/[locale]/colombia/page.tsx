import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { ColombiaApp } from "./_colombia/ColombiaApp";
import { getColombiaTeamState, getColombiaViewer } from "./_colombia/session";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ColombiaPage" });
  return { title: t("title") };
}

/**
 * Colombia students with a team only; everyone else goes to the Colombia login.
 * The screen (?phase=…) is read by ColombiaApp in the browser.
 */
export default async function ColombiaPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await getColombiaViewer();
  if (viewer.kind !== "student" || !viewer.student.team) {
    return redirect({ href: "/colombia/login", locale });
  }
  const state = await getColombiaTeamState();
  if (!state) {
    const t = await getTranslations({ locale, namespace: "Colombia" });
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-24 text-center">
        <p>{t("unavailable")}</p>
        <a className="underline" href="">
          {t("retry")}
        </a>
      </main>
    );
  }
  return (
    <ColombiaApp
      initialState={state}
      isAdmin={viewer.student.is_admin === true}
    />
  );
}
