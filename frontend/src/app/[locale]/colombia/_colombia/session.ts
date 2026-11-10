import { cache } from "react";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { API_URL, type ColombiaStudent } from "./student";
import type { TeamState } from "./teamSync";

const ME_TIMEOUT_MS = 3000;

export type ColombiaViewer =
  /** No session, or a session that is not a Colombia student (e.g. a New York account). */
  | { kind: "signedOut" }
  | { kind: "student"; student: ColombiaStudent }
  /** The backend could not be reached; show the login form with a notice. */
  | { kind: "unavailable" };

/**
 * Server-side: the signed-in Colombia student, from /api/colombia/me. The backend
 * verifies the token and rejects anyone without a Colombia student record.
 * Cached per request.
 */
export const getColombiaViewer = cache(async (): Promise<ColombiaViewer> => {
  await connection();
  if (!isSupabaseConfigured()) return { kind: "signedOut" };

  const supabase = await createClient();
  // The backend verifies this token, so the unverified cookie session is enough here.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { kind: "signedOut" };

  try {
    const response = await fetch(`${API_URL}/api/colombia/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(ME_TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403)
      return { kind: "signedOut" };
    if (!response.ok) return { kind: "unavailable" };
    return {
      kind: "student",
      student: (await response.json()) as ColombiaStudent,
    };
  } catch {
    return { kind: "unavailable" };
  }
});

/**
 * Server-side: the student's team state (answers, timers, progress), for the
 * first render of the dashboard. Null if the backend could not be reached;
 * the dashboard then loads it in the browser.
 */
export async function getColombiaTeamState(): Promise<TeamState | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  try {
    const response = await fetch(`${API_URL}/api/colombia/team/state`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(ME_TIMEOUT_MS),
    });
    return response.ok ? ((await response.json()) as TeamState) : null;
  } catch {
    return null;
  }
}
