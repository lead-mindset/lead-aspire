"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import styles from "../../new-york/_aspire/aspire.module.css";
import {
  CASE_BRIEF,
  PROMPTS,
  REQUEST_CSV,
  ROLES,
  STEPS,
  STEP_KEYS,
  recommendPrompt,
  type RoleKey,
  type StepKey,
} from "./data";
import { Celebration } from "./celebrate";
import { CopyButton, DownloadButton, LearnBox, PhotoBanner, ProgressStrip, PromptCard, RICH } from "./pieces";
import { useLabProgress } from "./progress";
import lab from "./nyc.module.css";

export function StepView({ step }: { step: StepKey }) {
  const t = useTranslations("NycSchools");
  const router = useRouter();
  const { completed, toggleStep } = useLabProgress();
  const info = STEPS[step];
  const done = completed.includes(step);
  const nextKey = STEP_KEYS[STEP_KEYS.indexOf(step) + 1];
  const nextHref = nextKey ? `/nycschools/${nextKey}` : "/nycschools";
  const nextLabel = nextKey ? t("done.next", { step: t(`steps.${nextKey}.title`) }) : t("done.finish");
  /** Lab progress (%) before and after marking this step, while the celebration shows. */
  const [celebration, setCelebration] = useState<{ from: number; to: number } | null>(null);

  function toggle() {
    if (!done) {
      const pct = (count: number) => Math.round((count / STEP_KEYS.length) * 100);
      setCelebration({ from: pct(completed.length), to: pct(completed.length + 1) });
    }
    toggleStep(step);
  }

  return (
    <div className={styles.phasePage}>
      <ProgressStrip />

      <PhotoBanner banner={info.banner}>
        <div className={styles.bannerHead}>
          <span className={`${styles.bannerBadge} ${info.tone === "red" ? styles.toneRed : styles.tonePurple}`}>
            {info.num}
          </span>
          <div className={styles.bannerTitles}>
            <h1 className={styles.bannerTitle}>{t(`steps.${step}.title`)}</h1>
            <span className={styles.bannerTagline}>
              {t(`steps.${step}.heading`)} · {t("minutes", { count: info.minutes })}
            </span>
          </div>
        </div>
        <p className={styles.bannerDesc}>{t(`steps.${step}.desc`)}</p>
      </PhotoBanner>

      <section className={lab.stack}>
        <h2 className={styles.sectionLabel}>{t("activitiesLabel")}</h2>
        <div className={lab.cards}>
          <StepActivities step={step} />
        </div>
      </section>

      <LearnBox title={t(`learn.${step}.title`)}>{t.rich(`learn.${step}.body`, RICH)}</LearnBox>

      <div className={`${styles.donePanel} ${done ? styles.donePanelDone : ""}`}>
        <div className={styles.doneText}>
          <span className={styles.doneTitle}>{done ? t("done.titleDone") : t("done.title")}</span>
          <span className={styles.doneSub}>{done ? t("done.subDone") : t("done.sub")}</span>
        </div>
        <button
          type="button"
          className={done ? styles.undoButton : styles.ctaButton}
          onClick={toggle}
          aria-pressed={done}
        >
          {done ? t("done.undo") : t("done.mark")}
        </button>
        {done && (
          <Link href={nextHref} className={styles.ctaButton}>
            {nextLabel} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>

      {celebration && (
        <Celebration
          from={celebration.from}
          to={celebration.to}
          title={
            celebration.to === 100
              ? t("celebrate.titleDone")
              : t("celebrate.title", { step: t(`steps.${step}.title`) })
          }
          body={celebration.to === 100 ? t("celebrate.bodyDone") : t("celebrate.body", { pct: celebration.to })}
          action={nextLabel}
          onAction={() => {
            setCelebration(null);
            router.push(nextHref);
          }}
          onClose={() => setCelebration(null)}
        />
      )}
    </div>
  );
}

function StepActivities({ step }: { step: StepKey }) {
  const t = useTranslations("NycSchools");

  switch (step) {
    case "discover":
      return (
        <>
          <PromptCard badge={t("badges.case")} title={t("caseBrief.title")} text={CASE_BRIEF}>
            <CopyButton text={CASE_BRIEF} label={t("caseBrief.copy")} />
            <DownloadButton file="case" label={t("caseBrief.download")} />
          </PromptCard>
          <PromptCard badge={t("badges.prompt")} title={t("prompts.analyze")} text={PROMPTS.analyze}>
            <CopyButton text={PROMPTS.analyze} label={t("copy")} primary />
          </PromptCard>
        </>
      );
    case "explore":
      return <ExploreActivities />;
    case "refine":
      return (
        <>
          <PromptCard badge={t("badges.prompt")} title={t("prompts.critique")} text={PROMPTS.critique}>
            <CopyButton text={PROMPTS.critique} label={t("copy")} primary />
          </PromptCard>
          <PromptCard badge={t("badges.optional")} title={t("prompts.followUp")} text={PROMPTS.followUp}>
            <CopyButton text={PROMPTS.followUp} label={t("copy")} />
          </PromptCard>
        </>
      );
    case "apply":
      return <ApplyActivities />;
  }
}

function ExploreActivities() {
  const t = useTranslations("NycSchools");
  const [role, setRole] = useState<RoleKey>("operations");
  const prompt = recommendPrompt(role);

  return (
    <>
      <PromptCard badge={t("badges.prompt")} title={t("prompts.recommend")}>
        <label className={lab.field}>
          <span className={lab.fieldLabel}>{t("roles.label")}</span>
          <select className={lab.input} value={role} onChange={(event) => setRole(event.target.value as RoleKey)}>
            {(Object.keys(ROLES) as RoleKey[]).map((key) => (
              <option key={key} value={key}>
                {t(`roles.options.${key}`)}
              </option>
            ))}
          </select>
        </label>
        <p className={`${lab.promptText} ${lab.fullRow}`}>{prompt}</p>
        <CopyButton text={prompt} label={t("copy")} primary />
      </PromptCard>
      <PromptCard badge={t("badges.optional")} title={t("data.title")}>
        <p className={`${styles.resourceText} ${lab.fullRow}`}>{t("data.body")}</p>
        <DownloadButton file="csv" label={t("data.download")} />
        <CopyButton text={REQUEST_CSV} label={t("data.copy")} />
      </PromptCard>
    </>
  );
}

function ApplyActivities() {
  const t = useTranslations("NycSchools");
  const [takeaway, setTakeaway] = useState("");

  return (
    <>
      <PromptCard badge={t("badges.prompt")} title={t("prompts.brief")} text={PROMPTS.brief}>
        <CopyButton text={PROMPTS.brief} label={t("copy")} primary />
        <DownloadButton file="template" label={t("template.download")} />
      </PromptCard>
      <PromptCard badge={t("badges.activity")} title={t("takeaway.title")}>
        <label className={lab.field}>
          <span className={lab.fieldLabel}>{t("takeaway.label")}</span>
          <textarea
            className={`${lab.input} ${lab.textarea}`}
            value={takeaway}
            onChange={(event) => setTakeaway(event.target.value)}
            placeholder={t("takeaway.placeholder")}
          />
        </label>
        <CopyButton
          text={() => (takeaway.trim() ? t("takeaway.prefix") + takeaway.trim() : null)}
          label={t("takeaway.copy")}
          emptyMessage={t("takeaway.empty")}
        />
        <p className={`${lab.fine} ${lab.fullRow}`}>{t("takeaway.note")}</p>
      </PromptCard>
    </>
  );
}
