import type { ReactNode } from "react";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/** Same gate as the New York app: signed-out visitors go to login. */
export default async function DallasLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  await connection();
  const user = isSupabaseConfigured() ? (await (await createClient()).auth.getUser()).data.user : null;
  if (!user) return redirect({ href: "/login", locale });

  return children;
}
