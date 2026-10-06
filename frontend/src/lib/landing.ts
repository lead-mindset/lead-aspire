import { cityHome } from "@/lib/cityRoutes";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ME_TIMEOUT_MS = 3000;

/** Why a signed-in user stays on the login page; keys of LoginPage.notices. */
export type LandingNotice = "inactiveAccount" | "noAccess" | "unknownCity" | "unavailable";

export type Landing =
  /** Show the login form: no session, or the backend no longer accepts it. */
  | { kind: "signedOut" }
  | { kind: "redirect"; href: string }
  | { kind: "notice"; notice: LandingNotice };

const DENIED_NOTICES: Record<string, LandingNotice> = {
  inactive_account: "inactiveAccount",
  access_denied: "noAccess",
};

/**
 * Server-side: where the current visitor should land.
 *
 * Visitors without a Supabase session cost nothing (the session is read from
 * cookies). With one, the backend's /api/auth/me decides the city. Every
 * failure resolves to the login page, never to another redirect, so the app
 * cannot loop between /login and a city page.
 */
export async function resolveLanding(): Promise<Landing> {
  if (!isSupabaseConfigured()) return { kind: "signedOut" };

  const supabase = await createClient();
  // The backend verifies this token, so the unverified cookie session is enough here.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { kind: "signedOut" };

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(ME_TIMEOUT_MS),
    });
  } catch {
    // Network error or timeout.
    return { kind: "notice", notice: "unavailable" };
  }

  if (response.status === 401) return { kind: "signedOut" };
  try {
    const body = (await response.json()) as { city_code?: string; detail?: { code?: string } };
    if (response.status === 403) {
      return { kind: "notice", notice: DENIED_NOTICES[body.detail?.code ?? ""] ?? "noAccess" };
    }
    if (!response.ok) return { kind: "notice", notice: "unavailable" };

    const href = cityHome(body.city_code);
    return href ? { kind: "redirect", href } : { kind: "notice", notice: "unknownCity" };
  } catch {
    return { kind: "notice", notice: "unavailable" };
  }
}
