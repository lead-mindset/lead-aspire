/**
 * Public origin of the site (no base path), e.g. https://www.leadmindset.org.
 * Under Multi Zones the browser talks to leadmain's domain, not this app's
 * Vercel domain, so server redirects use NEXT_PUBLIC_SITE_URL when it is set.
 */
export function getSiteOrigin(fallbackOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return configured ? new URL(configured).origin : fallbackOrigin;
}
