"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const t = useTranslations("DashboardPage");
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={signOut}>
      {t("signOut")}
    </Button>
  );
}
