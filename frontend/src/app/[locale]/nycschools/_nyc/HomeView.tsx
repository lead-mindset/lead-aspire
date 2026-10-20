"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "../../new-york/_aspire/aspire.module.css";
import { HOME_BANNER, STEP_KEYS } from "./data";
import { LearnBox, PhotoBanner, ProgressStrip, RICH } from "./pieces";
import { useLabProgress } from "./progress";
import lab from "./nyc.module.css";

const METRICS = ["requests", "response", "repeat"] as const;

/** Welcome step: the scenario, the mission and the case numbers. */
export function HomeView() {
  const t = useTranslations("NycSchools");
  const { currentIndex } = useLabProgress();

  const nextKey = STEP_KEYS[currentIndex < 0 ? 0 : currentIndex];
  const startLabel =
    currentIndex < 0
      ? t("home.review")
      : currentIndex === 0
        ? t("home.start")
        : t("home.continue", { step: t(`steps.${nextKey}.title`) });

  return (
    <div className={styles.phasePage}>
      <PhotoBanner banner={HOME_BANNER}>
        <span className={styles.eyebrow}>{t("eyebrow")}</span>
        <h1 className={styles.bannerTitle}>{t("home.title")}</h1>
        <p className={styles.bannerDesc}>{t("home.intro")}</p>
      </PhotoBanner>

      <ProgressStrip />

      <section className={lab.stack}>
        <span className={styles.pill}>{t("home.pill")}</span>
        <h2 className={lab.heading}>{t("home.welcome")}</h2>
        <p className={lab.lead}>{t("home.desc")}</p>
        <p className={lab.notice}>{t.rich("home.situation", RICH)}</p>
      </section>

      <section className={lab.stack}>
        <h2 className={styles.sectionLabel}>{t("home.missionTitle")}</h2>
        <p className={lab.lead}>{t.rich("home.mission", RICH)}</p>
        <ul className={lab.metrics} aria-label={t("home.metricsLabel")}>
          {METRICS.map((key) => (
            <li key={key} className={lab.metric}>
              <strong className={lab.metricValue}>{t(`home.metrics.${key}.value`)}</strong>
              <span className={lab.metricLabel}>{t(`home.metrics.${key}.label`)}</span>
            </li>
          ))}
        </ul>
      </section>

      <LearnBox title={t("home.practiceTitle")}>{t("home.practice")}</LearnBox>

      <div className={lab.stack}>
        <div>
          <Link href={`/nycschools/${nextKey}`} className={styles.ctaButton}>
            {startLabel} <span aria-hidden="true">→</span>
          </Link>
        </div>
        <p className={lab.fine}>{t("home.disclaimer")}</p>
      </div>
    </div>
  );
}
