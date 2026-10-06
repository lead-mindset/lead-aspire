import Image from "next/image";
import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Link as ExternalLink } from "@/components/ui/Link";
import { Link } from "@/i18n/navigation";
import { withBasePath } from "@/lib/basePath";
import { CopyButton } from "../CopyButton";
import { EmailGate } from "../EmailGate";
import { PARTS } from "../steps";

type Props = { params: Promise<{ locale: string }> };

const FIRST_STEP = PARTS.reduce<number[]>(
  (acc, part, i) => [...acc, i === 0 ? 1 : acc[i - 1] + PARTS[i - 1].steps.length],
  [],
);

export default function NewYorkGuidesPage({ params }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("NewYorkPage");

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-7 px-4 py-7 sm:py-8">
      <header className="flex flex-col gap-4">
        <Link href="/new-york" className={buttonClasses({ variant: "ghost", size: "sm", className: "self-start" })}>
          <Icon name="arrow-left" size={18} />
          {t("backDashboard")}
        </Link>
        <p className="font-display text-overline text-primary uppercase">{t("overline")}</p>
        <h1 className="text-h1 sm:text-display">{t("title")}</h1>
        <p className="text-body-lg text-ink-muted">{t("intro")}</p>
      </header>
      <EmailGate>
        {PARTS.map((part, partIndex) => (
          <section key={part.id} aria-labelledby={`part-${part.id}`} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1 border-b border-line pb-3">
              <p className="font-display text-overline text-accent uppercase">{t("partLabel", { n: partIndex + 1 })}</p>
              <h2 id={`part-${part.id}`}>{t(`parts.${part.id}`)}</h2>
            </div>
            <ol className="flex flex-col gap-6">
              {part.steps.map((step, stepIndex) => {
                const n = FIRST_STEP[partIndex] + stepIndex;
                const title = t(`steps.${step.id}.title`);
                return (
                  <li key={step.id} className="flex gap-4">
                    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-primary-soft font-display text-label text-primary">{n}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
                      <h3 className="text-h4"><span className="sr-only">{t("stepLabel", { n })}: </span>{title}</h3>
                      <p>{t(`steps.${step.id}.body`)}</p>
                      {step.href && <ExternalLink href={step.href} target="_blank" rel="noopener noreferrer" iconRight="arrow-right" className="self-start">{t(`steps.${step.id}.link`)}</ExternalLink>}
                      {step.prompt && <div className="flex flex-col overflow-hidden rounded-md border border-line bg-surface-alt"><div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2"><span className="text-label">{t("promptLabel")}</span><CopyButton text={step.prompt} /></div><pre className="overflow-auto p-4 font-sans text-small whitespace-pre-wrap">{step.prompt}</pre></div>}
                      {step.screenshots.map((shot, i) => <a key={shot.src} href={withBasePath(shot.src)} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border border-line shadow-sm"><Image src={withBasePath(shot.src)} alt={t("screenshotAlt", { step: title, n: i + 1, total: step.screenshots.length })} width={shot.width} height={shot.height} sizes="(min-width: 768px) 700px, 100vw" className="h-auto w-full" /></a>)}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </EmailGate>
    </article>
  );
}
