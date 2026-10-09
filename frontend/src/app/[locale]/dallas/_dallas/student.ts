/** The signed-in Dallas student, as returned by GET /api/dallas/me. */
export type DallasTeam = { id: number; number: number; name: string };

export type DallasStudent = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  /** Null until the student picks a team on the login screen (Step 2). */
  team: DallasTeam | null;
  members: { first_name: string; last_name: string }[];
};

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** "Ana Pérez": how members appear in the dashboard's role dropdowns. */
export function memberName(member: {
  first_name: string;
  last_name: string;
}): string {
  return `${member.first_name} ${member.last_name}`.trim();
}

/** The team number as shown on the badge: 8 -> "08". */
export function teamBadge(team: { number: number }): string {
  return String(team.number).padStart(2, "0");
}
