import { cache } from "react";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { API_URL, type DallasStudent } from "./student";

const ME_TIMEOUT_MS = 3000;

export type DallasViewer =
  /** No session, or a session that is not a Dallas student (e.g. a New York account). */
  | { kind: "signedOut" }
  | { kind: "student"; student: DallasStudent }
  /** The backend could not be reached; show the login form with a notice. */
  | { kind: "unavailable" };

/**
 * Server-side: the signed-in Dallas student, from /api/dallas/me. The backend
 * verifies the token and rejects anyone without a Dallas student record.
 * Cached per request.
 */
export const getDallasViewer = cache(async (): Promise<DallasViewer> => {
  await connection();
  if (!isSupabaseConfigured()) return { kind: "signedOut" };

  const supabase = await createClient();
  // The backend verifies this token, so the unverified cookie session is enough here.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { kind: "signedOut" };

  try {
    const response = await fetch(`${API_URL}/api/dallas/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(ME_TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403)
      return { kind: "signedOut" };
    if (!response.ok) return { kind: "unavailable" };
    return {
      kind: "student",
      student: (await response.json()) as DallasStudent,
    };
  } catch {
    return { kind: "unavailable" };
  }
});
