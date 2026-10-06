"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./aspire.module.css";

/** Renders a .docx from public/ in the browser (docx-preview, loaded on demand). */
export function DocxPreview({ file }: { file: string }) {
  const t = useTranslations("Aspire.viewer");
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const [{ renderAsync }, response] = await Promise.all([import("docx-preview"), fetch(file)]);
      if (!response.ok) throw new Error(`docx ${response.status}`);
      const blob = await response.blob();
      if (cancelled || !container.current) return;
      container.current.innerHTML = "";
      await renderAsync(blob, container.current, undefined, {
        inWrapper: true,
        ignoreLastRenderedPageBreak: true,
      });
      if (!cancelled) setStatus("ready");
    }

    render().catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [file]);

  return (
    <div className={styles.docxPreview}>
      {status !== "ready" && (
        <div className={styles.viewerEmpty}>{status === "loading" ? t("wordLoading") : t("wordError")}</div>
      )}
      <div ref={container} hidden={status !== "ready"} />
    </div>
  );
}
