"use client";

// Shown when a lab step is marked as done (adapted from the Dallas
// celebration): the astronaut flies in, the progress ring fills from the
// old percentage to the new one and confetti falls. Motion is skipped for
// prefers-reduced-motion.

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/basePath";
import styles from "../../new-york/_aspire/aspire.module.css";
import lab from "./nyc.module.css";

const RING = 2 * Math.PI * 54;
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

type Props = {
  /** Lab progress (0–100) before and after this step. */
  from: number;
  to: number;
  title: string;
  body: string;
  action: string;
  /** The card's button: usually goes to the next step. */
  onAction: () => void;
  /** Escape or a click outside the card. */
  onClose: () => void;
};

export function Celebration({ from, to, title, body, action, onAction, onClose }: Props) {
  const t = useTranslations("NycSchools.celebrate");
  // Only ever rendered after a click, so window exists.
  const [reduce] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [pct, setPct] = useState(reduce ? to : from);

  // Count the label up in step with the ring's CSS animation.
  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - (1 - p) ** 3;
      setPct(Math.round(from + (to - from) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, from, to]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={`dark ${lab.celebrate}`} onClick={onClose}>
      <div className={lab.confetti} aria-hidden="true">
        {CONFETTI.map((piece, i) => (
          <span
            key={i}
            className={`${lab.confettiPiece} ${piece.wide ? lab.confettiWide : ""}`}
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
        className={lab.celebrateCard}
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
          className={lab.celebrateAstronaut}
        />

        <div className={lab.celebrateRing}>
          <svg width="150" height="150" viewBox="0 0 124 124" aria-hidden="true">
            <circle className={lab.celebrateRingTrack} cx="62" cy="62" r="54" />
            <circle
              className={lab.celebrateRingValue}
              cx="62"
              cy="62"
              r="54"
              strokeDasharray={RING}
              style={
                {
                  "--ring-from": `${RING * (1 - from / 100)}`,
                  "--ring-to": `${RING * (1 - to / 100)}`,
                } as CSSProperties
              }
            />
          </svg>
          <span className={lab.celebrateRingLabel} aria-live="polite">
            {pct}%
          </span>
        </div>

        <span className={lab.celebrateEyebrow}>{to === 100 ? t("eyebrowDone") : t("eyebrow")}</span>
        <h2 id="celebrate-title" className={lab.celebrateTitle}>
          {title}
        </h2>
        <p className={lab.celebrateBody}>{body}</p>

        <button
          type="button"
          className={`${styles.pillButton} ${styles.pillButtonCta} ${lab.celebrateButton}`}
          onClick={onAction}
          autoFocus
        >
          {action}
        </button>
      </div>
    </div>
  );
}
