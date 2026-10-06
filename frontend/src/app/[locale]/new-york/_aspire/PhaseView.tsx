"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { withBasePath } from "@/lib/basePath";
import { useAspire } from "./AspireProvider";
import { TeamLogo, useJourneySteps } from "./TeamLogo";
import { DOCS, PHASES, PHASE_KEYS, PHASE_RESOURCES, type PhaseKey, type Resource } from "./data";
import styles from "./aspire.module.css";

export function PhaseView({ phase }: { phase: PhaseKey }) {
  const t = useTranslations("Aspire");
  const { viewer, completed, togglePhase, progress } = useAspire();
  const steps = useJourneySteps();
  const info = PHASES[phase];
  const done = completed.includes(phase);
  const nextKey = PHASE_KEYS[PHASE_KEYS.indexOf(phase) + 1];
  const remaining = PHASE_KEYS.length - completed.length;
  const pct = Math.round(progress * 100);

  return (
    <div className={styles.phasePage}>
      <div className={styles.teamStrip}>
        <div className={styles.stripTeam}>
          <TeamLogo size={44} />
          <div className={styles.stripTitle}>
            <b className={styles.stripName}>{viewer.teamName ?? t("team.fallbackName")}</b>
            <span className={styles.stripSub}>{t("team.city")}</span>
          </div>
        </div>
        <div className={styles.stripProgress}>
          <div className={styles.stripHead}>
            <strong>{t("progress.team", { pct })}</strong>
            <span>{remaining ? t("progress.remaining", { count: remaining, left: 100 - pct }) : t("progress.allDone")}</span>
          </div>
          <ol className={styles.segments}>
            {steps.map((step) => (
              <li
                key={step.key}
                title={step.label}
                className={`${styles.segment} ${step.done ? styles.segmentDone : ""} ${step.current ? styles.segmentCurrent : ""}`}
              >
                <div className={styles.segmentBar} />
                <span className={styles.segmentLabel}>{step.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <section className={`dark ${styles.banner}`}>
        <Image src={withBasePath(info.image)} alt="" fill sizes="(max-width: 960px) 100vw, 80vw" className={styles.bannerBg} />
        <div className={styles.bannerOverlay} />
        <div className={styles.bannerContent}>
          <div className={styles.bannerHead}>
            <span className={`${styles.bannerBadge} ${info.tone === "red" ? styles.toneRed : styles.tonePurple}`}>{info.num}</span>
            <div className={styles.bannerTitles}>
              <h1 className={styles.bannerTitle}>{t(`phases.${phase}.title`)}</h1>
              <span className={styles.bannerTagline}>{t(`phases.${phase}.tagline`)}</span>
            </div>
          </div>
          <p className={styles.bannerDesc}>{t(`phases.${phase}.desc`)}</p>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 className={styles.sectionLabel}>{t("resourcesLabel")}</h2>
        <div className={styles.resourceGrid}>
          {PHASE_RESOURCES[phase].map((resource) => (
            <ResourceCard key={resourceKey(resource)} resource={resource} />
          ))}
        </div>
      </section>

      <div className={`${styles.donePanel} ${done ? styles.donePanelDone : ""}`}>
        <div className={styles.doneText}>
          <span className={styles.doneTitle}>{done ? t("done.titleDone") : t("done.title")}</span>
          <span className={styles.doneSub}>{done ? t("done.subDone") : t("done.sub")}</span>
        </div>
        <button
          type="button"
          className={done ? styles.undoButton : styles.ctaButton}
          onClick={() => togglePhase(phase)}
          aria-pressed={done}
        >
          {done ? t("done.undo") : t("done.mark")}
        </button>
        {done && nextKey && (
          <Link href={`/new-york/${nextKey}`} className={styles.ctaButton}>
            {t("done.next", { phase: t(`phases.${nextKey}.title`) })} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </div>
  );
}

function resourceKey(resource: Resource) {
  return resource.kind === "doc" ? resource.doc : resource.kind;
}

function ResourceCard({ resource }: { resource: Resource }) {
  const t = useTranslations("Aspire");
  const { setOpenTarget, setSubmitOpen, setWhiteboardOpen, submission } = useAspire();

  if (resource.kind === "submit") {
    return (
      <div className={`dark ${styles.resource} ${styles.resourceSubmit}`}>
        <span className={`${styles.badge} ${styles.badgeSubmit}`}>
          {submission ? t("badges.submitted") : t("badges.upload")}
        </span>
        <h3 className={styles.resourceTitle}>{t("submit.title")}</h3>
        <p className={styles.resourceText}>{t("submit.desc")}</p>
        <button type="button" className={`${styles.pillButton} ${styles.pillButtonCta}`} onClick={() => setSubmitOpen(true)}>
          {submission ? t("submit.replace", { file: submission.deck }) : t("submit.cta")}
        </button>
      </div>
    );
  }

  if (resource.kind === "whiteboard") {
    return (
      <div className={styles.resource}>
        <span className={`${styles.badge} ${styles.badgeActivity}`}>{t("badges.activity")}</span>
        <h3 className={styles.resourceTitle}>{t("whiteboard.cardTitle")}</h3>
        <p className={styles.resourceText}>{t("whiteboard.cardDesc")}</p>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.pillButton} onClick={() => setWhiteboardOpen(true)}>
            {t("whiteboard.open")}
          </button>
          <button
            type="button"
            className={styles.pillButton}
            onClick={() => setOpenTarget({ kind: "doc", doc: "whiteboardExample" })}
          >
            {t("whiteboard.example")}
          </button>
        </div>
      </div>
    );
  }

  const isWord = DOCS[resource.doc].type === "word";
  return (
    <div className={styles.resource}>
      <span className={`${styles.badge} ${isWord ? styles.badgeWord : styles.badgePdf}`}>
        {isWord ? t("badges.word") : t("badges.pdf")}
      </span>
      <h3 className={styles.resourceTitle}>{t(`docs.${resource.doc}.title`)}</h3>
      <p className={styles.resourceText}>{t(`docs.${resource.doc}.desc`)}</p>
      <button
        type="button"
        className={`${styles.pillButton} ${isWord ? styles.pillButtonNeutral : ""}`}
        onClick={() => setOpenTarget({ kind: "doc", doc: resource.doc })}
      >
        {t(`docs.${resource.doc}.action`)}
      </button>
    </div>
  );
}
