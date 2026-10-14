"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/basePath";
import { DALLAS_COACH_ENABLED } from "@/lib/features";
import { CONTENT } from "./content";
import { PHASE_KEYS, type PhaseKey, type Screen } from "./data";
import { firstOpenPhase } from "./logic";
import styles from "./dallas.module.css";

const RING = 2 * Math.PI * 54;

type Props = {
  teamName: string;
  hasName: boolean;
  teamNumber: number;
  rolesAssigned: number;
  done: PhaseKey[];
  go: (screen: Screen) => void;
  onAskCoach: () => void;
};

/** Home (dallas-mockup-v2 "01b Home"). Image slots stay empty until real images exist. */
export function HomeView({
  teamName,
  hasName,
  teamNumber,
  rolesAssigned,
  done,
  go,
  onAskCoach,
}: Props) {
  const t = useTranslations("Dallas");
  const open = firstOpenPhase(done);
  const progress = done.length / PHASE_KEYS.length;
  const startLabel =
    open === null
      ? t("home.review")
      : open === "team"
        ? t("home.start")
        : t("home.continue", { phase: t(`phases.${open}`) });

  return (
    <>
      <section className={`dark ${styles.hero}`}>
        <Image
          src={withBasePath("/dashboard/hero-students-centered.png")}
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.heroBg}
        />
        <div
          className={`${styles.slot} ${styles.heroSlot}`}
          aria-hidden="true"
        />
        <div className={styles.heroOverlay} />
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <Image
              src={withBasePath("/dashboard/microsoft-logo.svg")}
              alt="Microsoft"
              width={190}
              height={32}
              className={styles.microsoftLogo}
            />
            <span className={styles.eyebrow}>{t("home.eyebrow")}</span>
            <h1 className={styles.heroTitle}>
              <span>{t("home.titleFirst")}</span>
              <span className={styles.gradientText}>
                {t("home.titleAccent")}
              </span>
              <span>{t("home.titleLast")}</span>
            </h1>
            <p className={styles.heroIntro}>{t("home.intro")}</p>
            <div>
              <button
                type="button"
                className={styles.heroCta}
                onClick={() => go(open ?? "pitch")}
              >
                {startLabel}
              </button>
            </div>
          </div>

          <div className={styles.heroCards}>
            <article className={styles.homeCard}>
              <span
                className={`${styles.slot} ${styles.teamLogoLarge}`}
                aria-hidden="true"
              />
              <div className={styles.homeCardText}>
                <span className={styles.homePill}>
                  {t("home.teamPill", {
                    num: teamNumber,
                    count: rolesAssigned,
                    total: CONTENT.roles.length,
                  })}
                </span>
                <h2 className={styles.homeTeamName}>{teamName}</h2>
                <p className={styles.muted}>
                  {hasName ? t("home.teamSubSet") : t("home.teamSubEmpty")}
                </p>
              </div>
            </article>

            <article className={styles.homeCard}>
              <div className={styles.ring}>
                <svg
                  width="116"
                  height="116"
                  viewBox="0 0 124 124"
                  aria-hidden="true"
                >
                  <circle className={styles.ringTrack} cx="62" cy="62" r="54" />
                  <circle
                    className={styles.ringValue}
                    cx="62"
                    cy="62"
                    r="54"
                    strokeDasharray={RING}
                    strokeDashoffset={RING * (1 - progress)}
                  />
                </svg>
                <span className={styles.ringLabel}>
                  {Math.round(progress * 100)}%
                </span>
              </div>
              <div className={styles.homeCardText}>
                <h3 className={styles.homeProgressTitle}>
                  {t("home.progressTitle")}
                </h3>
                <ol className={styles.homeSteps}>
                  {PHASE_KEYS.map((key) => {
                    const isDone = done.includes(key);
                    const current = key === open;
                    return (
                      <li
                        key={key}
                        className={`${styles.homeStep} ${isDone ? styles.homeStepDone : ""} ${current ? styles.homeStepCurrent : ""}`}
                      >
                        <span className={styles.homeStepDot}>
                          {isDone ? "✓" : ""}
                        </span>
                        {t(`phases.${key}`)}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.howSection}>
        <div className={styles.howCard}>
          <div className={styles.homeCardText}>
            <h3 className={styles.homeProgressTitle}>{t("home.helpTitle")}</h3>
            <p className={styles.muted}>{t("home.helpBody")}</p>
            <div>
              <button
                type="button"
                className={styles.coachButton}
                onClick={onAskCoach}
                disabled={!DALLAS_COACH_ENABLED}
              >
                {t("home.helpAsk")}
              </button>
            </div>
          </div>
          <Image
            src={withBasePath("/dashboard/astronaut.png")}
            alt=""
            width={140}
            height={120}
            className={styles.mascot}
          />
        </div>
      </section>
    </>
  );
}
