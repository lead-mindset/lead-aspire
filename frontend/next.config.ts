import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { normalizeBasePath } from "./src/lib/basePath";

// "" at the root (aspire.leadmindset.org), or a sub-path such as "/aspire" if ever needed.
const basePath = normalizeBasePath(process.env.BASE_PATH);

if (basePath && !/^(\/[A-Za-z0-9._~-]+)+$/.test(basePath)) {
  // Git Bash on Windows rewrites "/talent" to "C:/Program Files/Git/talent".
  // Use .env.local, PowerShell, or MSYS_NO_PATHCONV=1 to avoid that.
  throw new Error(
    `Invalid BASE_PATH "${basePath}". Expected something like "/talent".`,
  );
}

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  // BASE_PATH has no NEXT_PUBLIC_ prefix, so Next would only expose it on the
  // server. Inline the normalized value at build time so client code
  // (withBasePath) sees it too. It is not a secret: it is part of every URL.
  env: { BASE_PATH: basePath },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
