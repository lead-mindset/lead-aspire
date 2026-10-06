/**
 * Where each city lands after sign-in. The backend decides the city
 * (city_code from /api/auth/login and /api/auth/me); this is the only place
 * that maps it to a page. Admins without a city get "NYC" from the backend.
 */
const CITY_HOMES: Record<string, string> = {
  NYC: "/new-york",
  DFW: "/dallas",
};

/** The landing path for a backend city_code, or null for an unknown city. */
export function cityHome(cityCode: string | null | undefined): string | null {
  return (cityCode && CITY_HOMES[cityCode]) || null;
}
