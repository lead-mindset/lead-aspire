"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { withBasePath } from "@/lib/basePath";
import { initialsOf, useAspire } from "./AspireProvider";
import { TeamLogo, useJourneySteps } from "./TeamLogo";
import { PHASE_KEYS } from "./data";
import styles from "./aspire.module.css";

const RING = 2 * Math.PI * 54;

// Program partners shown above the hero title. Heights balance each mark's built-in padding.
const PARTNERS = [
  { name: "Microsoft", src: "/dashboard/microsoft-logo.svg", width: 190, height: 32, className: styles.partnerMicrosoft },
  { name: "Mastercard", src: "/dashboard/mastercard-logo.svg", width: 152, height: 108, className: styles.partnerMastercard },
  { name: "EY", src: "/dashboard/ey-logo-on-dark.svg", width: 69, height: 69, className: styles.partnerEy },
];
export function HomeView() {
  const t = useTranslations("Aspire");
  const { viewer, members, progress, currentIndex, setCoachOpen } = useAspire();
  const steps = useJourneySteps();

  const nextKey = PHASE_KEYS[currentIndex < 0 ? 0 : currentIndex];
  const startLabel =
    currentIndex < 0
      ? t("home.review")
      : currentIndex === 0
        ? t("home.start")
        : t("home.continue", { phase: t(`phases.${nextKey}.title`) });

  return (
    <>
      <section className={styles.hero}>
        <Image
          src={withBasePath("/dashboard/hero-students-centered.png")}
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.heroBg}
        />
        <div className={styles.heroOverlay} />
        <div className={styles.heroGrid}>
          <div className={`dark ${styles.heroCopy}`}>
            <ul className={styles.partnerLogos} aria-label={t("home.partners")}>
              {PARTNERS.map((partner) => (
                <li key={partner.name}>
                  <Image
                    src={withBasePath(partner.src)}
                    alt={partner.name}
                    width={partner.width}
                    height={partner.height}
                    className={partner.className}
                  />
                </li>
              ))}
            </ul>
            <span className={styles.eyebrow}>{t("eyebrow")}</span>
            <h1 className={styles.heroTitle}>
              <span>{t("home.titleFirst")}</span>
              <span className={styles.gradientText}>{t("home.titleAccent")}</span>
              <span>{t("home.titleLast")}</span>
            </h1>
            <p className={styles.heroIntro}>{t("home.intro")}</p>
            <div>
              <Link href={`/new-york/${nextKey}`} className={`${styles.ctaButton} ${styles.heroCta}`}>
                {startLabel} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className={styles.heroCards}>
            <article className={`${styles.floatCard} ${styles.teamCard}`}>
              <TeamLogo size={120} />
              <div className={styles.teamInfo}>
                <span className={styles.pill}>{t("team.city")}</span>
                <h2 className={styles.teamName}>{viewer.teamName ?? t("team.fallbackName")}</h2>
                <p className={styles.tagline}>{t("team.tagline")}</p>
                {members.length > 0 && (
                  <ul className={styles.members} aria-label={t("team.members")}>
                    {members.map((name) => (
                      <li key={name} className={styles.member}>
                        <span className={styles.memberAvatar} aria-hidden="true">
                          {initialsOf(name)}
                        </span>
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>

            <article className={`${styles.floatCard} ${styles.progressCard}`}>
              <div className={styles.ring}>
                <svg width="116" height="116" viewBox="0 0 124 124" aria-hidden="true">
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
                <span className={styles.ringLabel}>{Math.round(progress * 100)}%</span>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <h3 className={styles.progressTitle}>{t("progress.title")}</h3>
                <ol className={styles.progressInfo}>
                  {steps.map((step) => (
                    <li
                      key={step.key}
                      className={`${styles.step} ${step.done ? styles.stepDone : ""} ${step.current ? styles.stepCurrent : ""}`}
                    >
                      <span className={styles.stepDot}>{step.done ? "✓" : ""}</span>
                      {step.label}
                    </li>
                  ))}
                </ol>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.homeBody}>
        <div className={styles.helpCard}>
          <div className={styles.helpText}>
            <h3 className={styles.helpTitle}>{t("help.title")}</h3>
            <p className={styles.helpBody}>{t("help.body")}</p>
            <div className={styles.buttonRow}>
              <button type="button" className={styles.coachButton} onClick={() => setCoachOpen(true)}>
                {t("help.ask")}
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
