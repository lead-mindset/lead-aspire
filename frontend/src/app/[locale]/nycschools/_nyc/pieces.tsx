"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/basePath";
import styles from "../../new-york/_aspire/aspire.module.css";
import { DOWNLOADS, STEP_KEYS, type Banner, type DownloadKey } from "./data";
import { useLabProgress } from "./progress";
import lab from "./nyc.module.css";

/** Tags allowed in rich messages (t.rich). */
export const RICH = {
  b: (chunks: ReactNode) => <b>{chunks}</b>,
  i: (chunks: ReactNode) => <i>{chunks}</i>,
};

type CopyProps = {
  /** Text to copy, or a function returning it (null cancels with `emptyMessage`). */
  text: string | (() => string | null);
  label: string;
  emptyMessage?: string;
  primary?: boolean;
};

export function CopyButton({ text, label, emptyMessage, primary = false }: CopyProps) {
  const t = useTranslations("NycSchools");
  const [status, setStatus] = useState<"idle" | "copied" | "failed" | "empty">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    const value = typeof text === "function" ? text() : text;
    if (value === null) {
      setStatus("empty");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  const message =
    status === "copied" ? t("copied") : status === "failed" ? t("copyFailed") : status === "empty" ? emptyMessage : null;

  return (
    <button
      type="button"
      className={`${styles.pillButton} ${primary ? styles.pillButtonCta : ""}`}
      onClick={copy}
    >
      <span aria-live="polite">{message ?? label}</span>
    </button>
  );
}

export function DownloadButton({ file, label }: { file: DownloadKey; label: string }) {
  function download() {
    const { name, type, text } = DOWNLOADS[file];
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <button type="button" className={`${styles.pillButton} ${styles.pillButtonNeutral}`} onClick={download}>
      {label}
    </button>
  );
}

/** Card with a badge, a title and the exact text to paste into Copilot Chat. */
export function PromptCard({
  badge,
  title,
  text,
  children,
}: {
  badge: string;
  title: string;
  text?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.resource} aria-label={title}>
      <span className={`${styles.badge} ${styles.badgeActivity}`}>{badge}</span>
      <h3 className={styles.resourceTitle}>{title}</h3>
      {text && <p className={lab.promptText}>{text}</p>}
      <div className={styles.buttonRow}>{children}</div>
    </section>
  );
}

/** Banner with a wide Dallas photo; the photo fades to purple behind the text on its left. */
export function PhotoBanner({ banner, children }: { banner: Banner; children: ReactNode }) {
  return (
    <section className={`dark ${styles.banner} ${lab.banner}`}>
      <Image
        src={withBasePath(banner.src)}
        alt=""
        fill
        priority
        sizes="(max-width: 960px) 100vw, 1200px"
        className={lab.bannerPhoto}
        style={{ objectPosition: banner.position }}
      />
      <div className={`${styles.bannerContent} ${lab.bannerContent}`}>{children}</div>
    </section>
  );
}

export function LearnBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className={lab.learn}>
      <b className={lab.learnTitle}>{title}</b>
      <p className={lab.learnBody}>{children}</p>
    </aside>
  );
}

/** Lab progress with one segment per step, as in the New York team strip. */
export function ProgressStrip() {
  const t = useTranslations("NycSchools");
  const { completed, currentIndex, progress } = useLabProgress();
  const remaining = STEP_KEYS.length - completed.length;
  const pct = Math.round(progress * 100);

  return (
    <div className={styles.teamStrip}>
      <div className={styles.stripProgress}>
        <div className={styles.stripHead}>
          <strong>{t("progress.label", { pct })}</strong>
          <span>{remaining ? t("progress.remaining", { count: remaining }) : t("progress.allDone")}</span>
        </div>
        <ol className={`${styles.segments} ${lab.segments}`}>
          {STEP_KEYS.map((key, index) => (
            <li
              key={key}
              className={`${styles.segment} ${completed.includes(key) ? styles.segmentDone : ""} ${
                index === currentIndex ? styles.segmentCurrent : ""
              }`}
            >
              <div className={styles.segmentBar} />
              <span className={styles.segmentLabel}>{t(`steps.${key}.title`)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
