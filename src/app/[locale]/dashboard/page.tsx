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
    <section className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 py-7 sm:py-8">
      <h1>{t("title")}</h1>
      <p>{t("signedInAs", { email: user.email ?? "" })}</p>
      <div>
        <SignOutButton />
      </div>
    </section>
  );
}
