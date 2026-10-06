import { setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";
import { redirect } from "@/i18n/navigation";
import { resolveLanding } from "@/lib/landing";

type Props = {
  params: Promise<{ locale: string }>;
};

/** Signed-in users go straight to their city; the form only renders otherwise. */
export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const landing = await resolveLanding();
  if (landing.kind === "redirect") return redirect({ href: landing.href, locale });

  return <LoginForm notice={landing.kind === "notice" ? landing.notice : undefined} />;
}
