import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { ColombiaLogin } from "../_colombia/ColombiaLogin";
import { getColombiaViewer } from "../_colombia/session";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ColombiaLogin" });
  return { title: t("title") };
}

/**
 * Colombia login: email + event code, then (first login only) name and team.
 * A student who already has a team goes straight to the dashboard; one who
 * signed in but has no team yet (e.g. after a refresh) resumes at Step 2.
 */
export default async function ColombiaLoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await getColombiaViewer();
  if (viewer.kind === "student" && viewer.student.team) {
    return redirect({ href: "/colombia", locale });
  }
  return (
    <ColombiaLogin
      initialStep={viewer.kind === "student" ? "profile" : "credentials"}
      unavailable={viewer.kind === "unavailable"}
    />
  );
}
