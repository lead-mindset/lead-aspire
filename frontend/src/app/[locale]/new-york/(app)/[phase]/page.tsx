import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PhaseView } from "../../_aspire/PhaseView";
import { isPhaseKey } from "../../_aspire/data";

type Props = { params: Promise<{ locale: string; phase: string }> };

export default async function NewYorkPhasePage({ params }: Props) {
  const { locale, phase } = await params;
  setRequestLocale(locale);
  if (!isPhaseKey(phase)) notFound();
  return <PhaseView phase={phase} />;
}
