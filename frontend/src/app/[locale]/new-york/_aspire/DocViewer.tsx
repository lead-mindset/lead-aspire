"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/basePath";
import { useAspire } from "./AspireProvider";
import { DOCS } from "./data";
import { DocxPreview } from "./DocxPreview";
import styles from "./aspire.module.css";

/** Modal reader for phase guides (PDF inline) and organizer deck previews. */
export function DocViewer() {
  const t = useTranslations("Aspire");
  const { openTarget, setOpenTarget } = useAspire();

  useEffect(() => {
    if (!openTarget) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpenTarget(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTarget, setOpenTarget]);

  if (!openTarget) return null;

  let title: string;
  let badge: string;
  let badgeClass: string;
  let file: string | null = null;
  /** Where Download points; differs from `file` for signed deck links. */
  let downloadHref: string | null = null;
  let demoLink: string | null = null;
  let emptyText: string;

  if (openTarget.kind === "doc") {
    const doc = DOCS[openTarget.doc];
    title = t(`docs.${openTarget.doc}.title`);
    badge = t(`badges.${doc.type}`);
    badgeClass = doc.type === "word" ? styles.badgeWord : doc.type === "image" ? styles.badgeActivity : styles.badgePdf;
    file = doc.file ? withBasePath(doc.file) : null;
    downloadHref = file;
    emptyText = doc.type === "word" ? t("viewer.wordSoon") : t("viewer.pdfSoon");
  } else {
    title = `${openTarget.team} — ${openTarget.file}`;
    badge = t("badges.deck");
    badgeClass = styles.badgePdf;
    file = openTarget.viewUrl;
    downloadHref = openTarget.downloadUrl;
    demoLink = openTarget.demoLink;
    emptyText = t("viewer.deckNoPreview");
  }

  // Signed URLs carry a query string, so detect the type from the file name.
  const name = (openTarget.kind === "deck" ? openTarget.file : file ?? "").toLowerCase().split("?")[0];
  const inlinePdf = file && name.endsWith(".pdf");
  const inlineDocx = file && name.endsWith(".docx");
  const inlineImage = file && /\.(png|jpe?g|webp|svg)$/.test(name);

  return (
    <div className={styles.overlay} onClick={() => setOpenTarget(null)}>
      <div
        className={styles.viewer}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.viewerHeader}>
          <span className={`${styles.badge} ${badgeClass}`}>{badge}</span>
          <h2 className={styles.viewerTitle}>{title}</h2>
          {demoLink && (
            <a className={styles.ghostButton} href={demoLink} target="_blank" rel="noopener noreferrer">
              {t("viewer.demo")}
            </a>
          )}
          {downloadHref && (
            <a className={styles.ctaButton} href={downloadHref} download>
              {t("viewer.download")}
            </a>
          )}
          <button type="button" className={styles.ghostButton} onClick={() => setOpenTarget(null)} autoFocus>
            {t("viewer.back")}
          </button>
        </div>
        <div className={styles.viewerBody}>
          {inlinePdf ? (
            <iframe className={styles.viewerFrame} src={file!} title={title} />
          ) : inlineDocx ? (
            <DocxPreview key={file} file={file!} />
          ) : inlineImage ? (
            // Static file from public/; shown at its natural ratio inside the viewer.
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.viewerImage} src={file!} alt={title} />
          ) : (
            <div className={styles.viewerEmpty}>{emptyText}</div>
          )}
        </div>
      </div>
    </div>
  );
}
