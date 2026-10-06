import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { redirect } from "@/i18n/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
};

async function getUser() {
  // Always render per request, even when Supabase is not configured at build time.
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Example protected page: redirects to login when there is no session. */
export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getUser();
  if (!user) {
    return redirect({ href: "/login", locale });
  }

  const t = await getTranslations("DashboardPage");

  return (
    <section className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-overline uppercase tracking-widest text-primary">
            {t("eyebrow")}
          </p>
          <h1>{t("title")}</h1>
          <p className="text-body text-ink-muted">
            {t("signedInAs", { email: user.email ?? "" })}
          </p>
        </div>
        <SignOutButton />
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface-raised p-5 shadow-sm">
          <p className="text-label text-ink-muted">{t("progress.label")}</p>
          <p className="font-display text-h2 text-heading">{t("progress.value")}</p>
          <p className="text-small text-ink-muted">{t("progress.detail")}</p>
        </article>
        <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface-raised p-5 shadow-sm">
          <p className="text-label text-ink-muted">{t("next.label")}</p>
          <p className="font-display text-h3 text-heading">{t("next.value")}</p>
          <p className="text-small text-ink-muted">{t("next.detail")}</p>
        </article>
        <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface-raised p-5 shadow-sm">
          <p className="text-label text-ink-muted">{t("status.label")}</p>
          <p className="font-display text-h3 text-success">{t("status.value")}</p>
          <p className="text-small text-ink-muted">{t("status.detail")}</p>
        </article>
      </div>

      <div className="rounded-lg border border-line bg-surface-alt p-6">
        <h2>{t("welcomeTitle")}</h2>
        <p className="mt-2 max-w-2xl text-body text-ink-muted">
          {t("welcomeBody")}
        </p>
      </div>
    </section>
  );
}
