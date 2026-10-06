import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers around Next.js navigation APIs. Next adds basePath to
// these automatically, so never wrap their hrefs with withBasePath().
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
