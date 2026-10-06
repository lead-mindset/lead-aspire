const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Request to the FastAPI backend with the user's Supabase session token. */
export async function fetchWithSession(path: string, init: RequestInit = {}): Promise<Response | null> {
  const { createClient } = await import("@/lib/supabase/client");
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}
