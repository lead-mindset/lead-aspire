"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { withBasePath } from "@/lib/basePath";
import { createClient } from "@/lib/supabase/client";

type Props = {
  /** True when the auth callback redirected back with an error. */
  initialError?: boolean;
};

export function GoogleSignInButton({ initialError = false }: Props) {
  const t = useTranslations("LoginPage");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(initialError);

  async function signIn() {
    setPending(true);
    setFailed(false);

    // Supabase redirects back here after Google. The base path is not added
    // automatically for external redirects, so add it explicitly.
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const redirectTo = new URL(withBasePath("/auth/callback"), origin);
    redirectTo.searchParams.set("locale", locale);

    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo.toString() },
      });
      if (error) throw error;
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <Button size="lg" className="w-full" onClick={signIn} disabled={pending}>
        {pending ? t("redirecting") : t("google")}
      </Button>
      {failed && (
        <p
          role="alert"
          className="flex items-center gap-1 text-small text-danger"
        >
          <Icon name="alert" size={16} />
          {t("error")}
        </p>
      )}
    </div>
  );
}
