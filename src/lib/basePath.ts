/**
 * Base path helpers for Next.js Multi Zones.
 *
 * Each LEAD child app (Talent, Pulse, Aspire) is served under its own route of
 * www.leadmindset.org (e.g. /talent). Next.js prefixes <Link>, router pushes,
 * redirect() and /_next assets automatically. Everything else (images from
 * /public, <img>/<video> tags, client-side fetch, OAuth redirect URLs) must be
 * prefixed manually with withBasePath().
 */

/** Normalizes a base path to "" or "/segment" (leading slash, no trailing slash). */
export function normalizeBasePath(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/** The app's base path, e.g. "" at the root or "/talent" under leadmain. */
export const BASE_PATH = normalizeBasePath(process.env.BASE_PATH);

const ABSOLUTE_URL = /^([a-z][a-z\d+\-.]*:)?\/\//i;

/**
 * Prefixes a root-relative path with the base path.
 * Absolute URLs and already-prefixed paths are returned unchanged.
 */
export function withBasePath(path: string): string {
  if (ABSOLUTE_URL.test(path)) return path;

  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!BASE_PATH) return normalized;
  if (normalized === BASE_PATH || normalized.startsWith(`${BASE_PATH}/`)) {
    return normalized;
  }
  return normalized === "/" ? BASE_PATH : `${BASE_PATH}${normalized}`;
}
