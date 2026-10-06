import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { AspireProvider } from "../_aspire/AspireProvider";
import { AspireShell } from "../_aspire/AspireShell";
import { getAspireViewer } from "../_aspire/session";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

// Signed-in New York app (home, phases, organizer view). The public guides
// and resource pages live outside this route group and keep their own layout.
export default async function AspireAppLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await getAspireViewer();
  if (!viewer) return redirect({ href: "/login", locale });

  return (
    <AspireProvider viewer={viewer}>
      <AspireShell>{children}</AspireShell>
    </AspireProvider>
  );
}
