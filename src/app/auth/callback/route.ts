import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { withBasePath } from "@/lib/basePath";
import { getSiteOrigin } from "@/lib/siteUrl";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback: exchanges the Supabase code for a session, then redirects to
 * the locale home. `locale` is set by the login page in its redirectTo URL.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin: requestOrigin } = request.nextUrl;
  const origin = getSiteOrigin(requestOrigin);
  const code = searchParams.get("code");
  const requestedLocale = searchParams.get("locale");
  const locale = hasLocale(routing.locales, requestedLocale)
    ? requestedLocale
    : routing.defaultLocale;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(withBasePath(`/${locale}`), origin));
    }
  }

  return NextResponse.redirect(
    new URL(withBasePath(`/${locale}/login?error=auth`), origin),
  );
}
