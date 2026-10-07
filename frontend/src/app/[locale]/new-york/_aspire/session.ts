import { cache } from "react";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type AspireViewer = {
  email: string;
  /** The group the user is assigned to in New York, shown as the team name. */
  teamName: string | null;
  /** aspire_profiles.is_admin: also sees the organizer "View Teams Results" page. */
  isOrganizer: boolean;
};

type AssignedAccess = {
  access_role: string;
  aspire_groups: { group_name: string } | null;
};

/** Signed-in New York viewer, or null when signed out. Cached per request. */
export const getAspireViewer = cache(async (): Promise<AspireViewer | null> => {
  await connection();
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;
  // Dallas accounts (marked by the Dallas login) never see the New York app.
  if (user.app_metadata?.aspire_city === "DFW") return null;

  const { data: city } = await supabase
    .from("aspire_cities")
    .select("id")
    .eq("code", "NYC")
    .maybeSingle();

  let access: AssignedAccess | null = null;
  if (city) {
    const { data } = await supabase
      .from("aspire_user_access")
      .select("access_role, aspire_groups(group_name)")
      .eq("user_id", user.id)
      .eq("city_id", city.id)
      .not("group_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    access = data as AssignedAccess | null;
  }

  const { data: profile } = await supabase
    .from("aspire_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return {
    email: user.email ?? "",
    teamName: access?.aspire_groups?.group_name ?? null,
    isOrganizer: profile?.is_admin === true,
  };
});
