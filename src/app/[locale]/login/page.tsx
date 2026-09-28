import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default function LoginPage({ params, searchParams }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const { error } = use(searchParams);
  const t = useTranslations("LoginPage");

  return (
    <section className="px-4 py-7 sm:py-8">
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-lg border border-line bg-surface-raised p-5 text-center">
        <h1>{t("title")}</h1>
        <p className="text-ink-muted">{t("subtitle")}</p>
        <GoogleSignInButton initialError={Boolean(error)} />
      </div>
    </section>
  );
}
