/**
 * Feature switches, inlined into the build (NEXT_PUBLIC_*): change them in
 * Vercel and redeploy.
 */

/** The AI coach. Off unless exactly "true"; it needs Foundry configured on the backend. */
export const COACH_ENABLED = process.env.NEXT_PUBLIC_COACH_ENABLED === "true";
