"use client";

// Shown over Home once the team submits its final recommendation (Pitch &
// Submit): the astronaut flies in, the progress ring fills to 100% and
// confetti falls. Motion is skipped for prefers-reduced-motion.

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/basePath";
import { PHASE_KEYS } from "./data";
import styles from "./dallas.module.css";

const RING = 2 * Math.PI * 54;
/** Progress before the last phase was completed (4 of 5 = 80%). */
const FROM = Math.round(((PHASE_KEYS.length - 1) / PHASE_KEYS.length) * 100);
const COUNT_MS = 1400;
const COLORS = ["#7c5cff", "#e8467c", "#ffb547", "#3fd0c9", "#ffffff"];

// Fixed pseudo-random spread, so render stays pure.
const CONFETTI = Array.from({ length: 42 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 53) % 24) / 10,
  duration: 2.6 + ((i * 29) % 15) / 10,
  drift: ((i * 61) % 120) - 60,
  spin: ((i * 83) % 2 ? 1 : -1) * (360 + ((i * 47) % 360)),
  color: COLORS[i % COLORS.length],
  wide: i % 3 === 0,
}));

export function Celebration({
  teamName,
  onClose,
}: {
  teamName: string;
  onClose: () => void;
}) {
  const t = useTranslations("Dallas.celebrate");
  // Only ever rendered after a click, so window exists.
  const [reduce] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [pct, setPct] = useState(reduce ? 100 : FROM);

  // Count the label up in step with the ring's CSS animation.
  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - (1 - p) ** 3;
      setPct(Math.round(FROM + (100 - FROM) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={`dark ${styles.celebrate}`} onClick={onClose}>
      <div className={styles.confetti} aria-hidden="true">
        {CONFETTI.map((piece, i) => (
          <span
            key={i}
            className={`${styles.confettiPiece} ${piece.wide ? styles.confettiWide : ""}`}
            style={
              {
                left: `${piece.left}%`,
                background: piece.color,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
                "--drift": `${piece.drift}px`,
                "--spin": `${piece.spin}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div
        className={styles.celebrateCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebrate-title"
        onClick={(event) => event.stopPropagation()}
      >
        <Image
          src={withBasePath("/dashboard/astronaut.png")}
          alt=""
          width={220}
          height={220}
          priority
          className={styles.celebrateAstronaut}
        />

        <div className={styles.celebrateRing}>
          <svg width="150" height="150" viewBox="0 0 124 124" aria-hidden="true">
            <circle className={styles.ringTrack} cx="62" cy="62" r="54" />
            <circle
              className={styles.celebrateRingValue}
              cx="62"
              cy="62"
              r="54"
              strokeDasharray={RING}
              style={
                {
                  "--ring-from": `${RING * (1 - FROM / 100)}`,
                } as CSSProperties
              }
            />
          </svg>
          <span className={styles.celebrateRingLabel} aria-live="polite">
            {pct}%
          </span>
        </div>

        <span className={styles.celebrateEyebrow}>{t("eyebrow")}</span>
        <h2 id="celebrate-title" className={styles.celebrateTitle}>
          {t("title")}
        </h2>
        <p className={styles.celebrateBody}>{t("body", { team: teamName })}</p>

        <button
          type="button"
          className={`${styles.pillButton} ${styles.pillButtonCta} ${styles.celebrateButton}`}
          onClick={onClose}
          autoFocus
        >
          {t("close")}
        </button>
      </div>
    </div>
  );
}
