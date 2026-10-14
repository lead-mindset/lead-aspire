/**
 * Feature switches, inlined into the build (NEXT_PUBLIC_*): change them in
 * Vercel and redeploy.
 */

/** The AI coach. Off unless exactly "true"; it needs Foundry configured on the backend. */
export const COACH_ENABLED = process.env.NEXT_PUBLIC_COACH_ENABLED === "true";

/** The Dallas coach (its own Foundry agent). Off unless exactly "true";
 * the backend needs FOUNDRY_DALLAS_AGENT_NAME. */
export const DALLAS_COACH_ENABLED =
  process.env.NEXT_PUBLIC_DALLAS_COACH_ENABLED === "true";

/** The Dallas phase countdown in the team bar. Off unless exactly "true". */
export const DALLAS_TIMER_ENABLED =
  process.env.NEXT_PUBLIC_DALLAS_TIMER_ENABLED === "true";
