import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { StepView } from "../_nyc/StepView";
import { isStepKey } from "../_nyc/data";

type Props = { params: Promise<{ locale: string; step: string }> };

export default async function NycSchoolsStepPage({ params }: Props) {
  const { locale, step } = await params;
  setRequestLocale(locale);
  if (!isStepKey(step)) notFound();
  return <StepView step={step} />;
}
