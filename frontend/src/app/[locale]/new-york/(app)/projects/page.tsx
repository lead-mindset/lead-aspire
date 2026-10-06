import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ProjectsView } from "../../_aspire/ProjectsView";
import { getAspireViewer } from "../../_aspire/session";

type Props = { params: Promise<{ locale: string }> };

// Admins only (aspire_profiles.is_admin).
export default async function NewYorkProjectsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await getAspireViewer();
  if (!viewer?.isOrganizer) notFound();
  return <ProjectsView />;
}
