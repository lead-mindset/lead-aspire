import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { DallasLogin } from "../_dallas/DallasLogin";
import { getDallasViewer } from "../_dallas/session";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "DallasLogin" });
  return { title: t("title") };
}

/**
 * Dallas login: email + event code, then (first login only) name and team.
 * A student who already has a team goes straight to the dashboard; one who
 * signed in but has no team yet (e.g. after a refresh) resumes at Step 2.
 */
export default async function DallasLoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await getDallasViewer();
  if (viewer.kind === "student" && viewer.student.team) {
    return redirect({ href: "/dallas", locale });
  }
  return (
    <DallasLogin
      initialStep={viewer.kind === "student" ? "profile" : "credentials"}
      unavailable={viewer.kind === "unavailable"}
    />
  );
}
