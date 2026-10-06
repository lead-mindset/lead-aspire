"use client";

import { useTranslations } from "next-intl";
import { initialsOf, useAspire } from "./AspireProvider";
import { PHASE_KEYS } from "./data";
import styles from "./aspire.module.css";

/** Circular team logo from Supabase Storage; the team initials until one is uploaded. */
export function TeamLogo({ size }: { size: number }) {
  const t = useTranslations("Aspire.team");
  const { viewer, teamLogo } = useAspire();

  return (
    <span
      className={`${styles.teamLogo} ${teamLogo ? styles.teamLogoFilled : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}
    >
      {teamLogo ? (
        // Short-lived signed Storage URL; next/image would need the host configured.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={teamLogo} alt={t("logoAlt")} />
      ) : (
        <span aria-hidden="true">{initialsOf(viewer.teamName ?? t("fallbackName"))}</span>
      )}
    </span>
  );
}

/** Team setup + the four phases, with done/current flags for trackers. */
export function useJourneySteps() {
  const t = useTranslations("Aspire");
  const { completed, currentIndex } = useAspire();
  return [
    { key: "teamSetup", label: t("steps.teamSetup"), done: true, current: false },
    ...PHASE_KEYS.map((key, index) => ({
      key,
      label: t(`phases.${key}.title`),
      done: completed.includes(key),
      current: index === currentIndex,
    })),
  ];
}
