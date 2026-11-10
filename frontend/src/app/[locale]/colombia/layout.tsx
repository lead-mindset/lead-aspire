import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * No auth gate here: it would also wrap /colombia/login. The dashboard
 * (page.tsx) checks the Colombia student itself.
 */
export default async function ColombiaLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return children;
}
