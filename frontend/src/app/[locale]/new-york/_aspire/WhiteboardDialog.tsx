"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAspire } from "./AspireProvider";
import type { WhiteboardHandle } from "./WhiteboardCanvas";
import styles from "./aspire.module.css";

const WhiteboardCanvas = dynamic(() => import("./WhiteboardCanvas"), {
  ssr: false,
  loading: () => <WhiteboardLoading />,
});

function WhiteboardLoading() {
  const t = useTranslations("Aspire.whiteboard");
  return <div className={styles.viewerEmpty}>{t("loading")}</div>;
}

/** Full-screen Excalidraw board for the Strategize whiteboard activity. */
export function WhiteboardDialog() {
  const t = useTranslations("Aspire.whiteboard");
  const locale = useLocale();
  const { whiteboardOpen, setWhiteboardOpen } = useAspire();
  const handle = useRef<WhiteboardHandle | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!whiteboardOpen) return;
    // Lock page scroll behind the board.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [whiteboardOpen]);

  if (!whiteboardOpen) return null;

  async function downloadPng() {
    if (!handle.current) return;
    setExporting(true);
    setNotice(null);
    try {
      const blob = await handle.current.exportPng();
      if (!blob) {
        setNotice(t("empty"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "aspire-whiteboard.png";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice(t("exportError"));
    } finally {
      setExporting(false);
    }
  }

  function close() {
    handle.current = null;
    setNotice(null);
    setWhiteboardOpen(false);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.whiteboard} role="dialog" aria-modal="true" aria-labelledby="whiteboard-title">
        <div className={styles.viewerHeader}>
          <span className={`${styles.badge} ${styles.badgeActivity}`}>{t("badge")}</span>
          <div className={styles.whiteboardTitles}>
            <h2 id="whiteboard-title" className={styles.viewerTitle}>
              {t("title")}
            </h2>
            <span className={styles.whiteboardHint}>{notice ?? t("hint")}</span>
          </div>
          <button type="button" className={styles.ctaButton} onClick={downloadPng} disabled={exporting}>
            {exporting ? t("exporting") : t("download")}
          </button>
          <button type="button" className={styles.ghostButton} onClick={close}>
            {t("close")}
          </button>
        </div>
        <div className={styles.whiteboardCanvas}>
          <WhiteboardCanvas
            langCode={locale === "es" ? "es-ES" : "en"}
            stickyLabels={{ add: t("addSticky"), text: t("stickyText") }}
            onReady={(next) => {
              handle.current = next;
            }}
          />
        </div>
      </div>
    </div>
  );
}
