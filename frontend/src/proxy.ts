import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/proxy";

const handleI18nRouting = createIntlMiddleware(routing);

/**
 * 1. next-intl resolves the locale and redirects/rewrites as needed.
 * 2. Supabase refreshes the session cookies on that same response.
 *
 * Works with or without basePath: Next.js strips the base path before
 * matching, and next-intl reads it from request.nextUrl.basePath.
 */
export async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  return updateSession(request, response);
}

export const config = {
  // "/" is listed separately so the bare base path (e.g. /talent) also matches.
  // Skip API routes, the auth callback, Next internals and files with an extension.
  matcher: ["/", "/((?!api/|auth/|_next/|_vercel/|.*\\..*).*)"],
};
