"use client";

// Strategize, Design Your Solution and Pitch & Submit, copied from the New
// York phase page (new-york/_aspire/PhaseView.tsx; Design is New York's
// Build): guide cards, a document viewer, the Excalidraw whiteboard in
// Strategize and the deck upload in Pitch & Submit (./submit.tsx).

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { withBasePath } from "@/lib/basePath";
import type { WhiteboardHandle } from "../../new-york/_aspire/WhiteboardCanvas";
import { stepNumber } from "./data";
import { SubmitDialog, useSubmission } from "./submit";
import styles from "./dallas.module.css";

const WhiteboardCanvas = dynamic(
  () => import("../../new-york/_aspire/WhiteboardCanvas"),
  { ssr: false, loading: () => <WhiteboardLoading /> },
);

/** Saved on this device only, apart from the New York board. */
const WHITEBOARD_KEY = "aspire.dallas.whiteboard";

type DocType = "pdf" | "word";

/**
 * Guides students open from a phase: New York's documents for now. Point
 * `file` at public/dallas/... to give Dallas its own version; null shows
 * "coming soon" in the viewer.
 */
const DOCS = {
  consulting: { type: "pdf", file: "/new-york/pdfs/consulting.pdf" },
  sow: { type: "word", file: "/new-york/pdfs/sow.docx" },
  review: { type: "pdf", file: "/new-york/pdfs/mdreview.pdf" },
  foundry: { type: "pdf", file: "/new-york/pdfs/foundry.pdf" },
  copilot: { type: "pdf", file: "/new-york/pdfs/copilot.pdf" },
  security: { type: "pdf", file: "/new-york/pdfs/security.pdf" },
  buildcheck: { type: "pdf", file: "/new-york/pdfs/buildcheck.pdf" },
  playbook: { type: "pdf", file: "/new-york/pdfs/playbook.pdf" },
  /** Opened from the photo in Discover > Company Profile, not a phase card. */
  briefing: {
    type: "pdf",
    file: "/dallas/pdfs/Contoso_Customer_Briefing.pdf",
  },
} satisfies Record<string, { type: DocType; file: string | null }>;

type DocKey = keyof typeof DOCS;

type ResourcePhase = "strategize" | "design" | "pitch";

type Resource =
  { kind: "doc"; doc: DocKey } | { kind: "whiteboard" } | { kind: "submit" };

type PhaseInfo = {
  /** Photo on the right of the banner. */
  image: string;
  /** Wide photo that fills the whole banner (fades to purple on its left); replaces `image`. */
  banner?: { src: string; position: string };
  resources: Resource[];
};

const PHASES: Record<ResourcePhase, PhaseInfo> = {
  strategize: {
    image: "/dashboard/strategize.png",
    // The heads sit near the top of the photo; keep them in the crop.
    banner: { src: "/dashboard/dallas-strategize.png", position: "right 10%" },
    resources: [
      { kind: "doc", doc: "consulting" },
      { kind: "whiteboard" },
      { kind: "doc", doc: "sow" },
      { kind: "doc", doc: "review" },
    ],
  },
  design: {
    image: "/dashboard/build.png",
    banner: {
      src: "/dashboard/dallas-strategize-build.png",
      position: "right 8%",
    },
    resources: [
      { kind: "doc", doc: "foundry" },
      { kind: "doc", doc: "copilot" },
      { kind: "doc", doc: "security" },
      { kind: "doc", doc: "buildcheck" },
    ],
  },
  pitch: {
    image: "/dashboard/pitch.png",
    banner: { src: "/dashboard/dallas-pitch.png", position: "right 15%" },
    resources: [{ kind: "doc", doc: "playbook" }, { kind: "submit" }],
  },
};

/** Opened from the whiteboard card, not listed as its own resource. */
const WHITEBOARD_EXAMPLE = "/new-york/whiteboard-example.png";

export type ViewerTarget =
  | { kind: "doc"; doc: DocKey }
  | { kind: "example" }
  /** A team's final deck, opened by an organizer (see teamsResults.tsx). */
  | {
      kind: "deck";
      team: string;
      file: string;
      viewUrl: string;
      downloadUrl: string;
      demoLink: string | null;
    };

type ResourcesProps = {
  phase: ResourcePhase;
  /** For the submit dialog's "{team} · ..." line. */
  teamName: string;
};

/** A phase page: banner, then its guide cards. */
export function PhaseResourcesView({ phase, teamName }: ResourcesProps) {
  return (
    <section className={styles.section}>
      <PhaseHero phase={phase} />
      <PhaseResources phase={phase} teamName={teamName} />
    </section>
  );
}

/** The phase banner with its step number and photo. */
export function PhaseHero({ phase }: { phase: ResourcePhase }) {
  const t = useTranslations("Dallas");
  const info = PHASES[phase];

  return (
    <div
      className={`dark ${styles.phaseHero} ${
        info.banner ? styles.phaseHeroBanner : styles.phaseHeroImage
      }`}
    >
      {info.banner ? (
        <Image
          src={withBasePath(info.banner.src)}
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 1500px"
          className={styles.phaseHeroBannerPhoto}
          style={{ objectPosition: info.banner.position }}
        />
      ) : (
        // Whole photo at banner height on the right; it fades into the banner.
        <Image
          src={withBasePath(info.image)}
          alt=""
          width={1536}
          height={1024}
          sizes="360px"
          className={styles.phaseHeroPhoto}
        />
      )}
      <span className={styles.phaseStep}>
        {t("discover.step", { num: stepNumber(phase) ?? 0 })}
      </span>
      <h1 className={styles.phaseHeroTitle}>{t(`phases.${phase}`)}</h1>
      <p className={styles.phaseHeroText}>{t(`resources.desc.${phase}`)}</p>
    </div>
  );
}

/** "Guides & resources": the phase's cards, with the viewer, whiteboard and submit dialogs. */
export function PhaseResources({ phase, teamName }: ResourcesProps) {
  const t = useTranslations("Dallas");
  const [openTarget, setOpenTarget] = useState<ViewerTarget | null>(null);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const info = PHASES[phase];
  const [submission, setSubmission] = useSubmission(
    info.resources.some((resource) => resource.kind === "submit"),
  );

  return (
    <>
      <h2 className={styles.sectionLabel}>{t("resources.label")}</h2>
      <div className={styles.resourceGrid}>
        {info.resources.map((resource) =>
          resource.kind === "doc" ? (
            <DocCard
              key={resource.doc}
              doc={resource.doc}
              onOpen={setOpenTarget}
            />
          ) : resource.kind === "submit" ? (
            <div
              key="submit"
              className={`dark ${styles.resource} ${styles.resourceSubmit}`}
            >
              <span className={`${styles.badge} ${styles.badgeSubmit}`}>
                {submission
                  ? t("resources.badges.submitted")
                  : t("resources.badges.upload")}
              </span>
              <h3 className={styles.resourceTitle}>
                {t("resources.submit.title")}
              </h3>
              <p className={styles.resourceText}>
                {t("resources.submit.desc")}
              </p>
              <button
                type="button"
                className={`${styles.pillButton} ${styles.pillButtonCta}`}
                onClick={() => setSubmitOpen(true)}
              >
                {submission
                  ? t("resources.submit.replace", { file: submission.deck })
                  : t("resources.submit.cta")}
              </button>
            </div>
          ) : (
            <div key="whiteboard" className={styles.resource}>
              <span className={`${styles.badge} ${styles.badgeActivity}`}>
                {t("resources.badges.activity")}
              </span>
              <h3 className={styles.resourceTitle}>
                {t("resources.whiteboard.cardTitle")}
              </h3>
              <p className={styles.resourceText}>
                {t("resources.whiteboard.cardDesc")}
              </p>
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.pillButton}
                  onClick={() => setWhiteboardOpen(true)}
                >
                  {t("resources.whiteboard.open")}
                </button>
                <button
                  type="button"
                  className={styles.pillButton}
                  onClick={() => setOpenTarget({ kind: "example" })}
                >
                  {t("resources.whiteboard.example")}
                </button>
              </div>
            </div>
          ),
        )}
      </div>

      {openTarget && (
        <DocViewer target={openTarget} onClose={() => setOpenTarget(null)} />
      )}
      {whiteboardOpen && (
        <WhiteboardDialog onClose={() => setWhiteboardOpen(false)} />
      )}
      {submitOpen && (
        <SubmitDialog
          teamName={teamName}
          submission={submission}
          onSaved={setSubmission}
          onClose={() => setSubmitOpen(false)}
        />
      )}
    </>
  );
}

function DocCard({
  doc,
  onOpen,
}: {
  doc: DocKey;
  onOpen: (target: ViewerTarget) => void;
}) {
  const t = useTranslations("Dallas.resources");
  const isWord = DOCS[doc].type === "word";

  return (
    <div className={styles.resource}>
      <span
        className={`${styles.badge} ${isWord ? styles.badgeWord : styles.badgePdf}`}
      >
        {isWord ? t("badges.word") : t("badges.pdf")}
      </span>
      <h3 className={styles.resourceTitle}>{t(`docs.${doc}.title`)}</h3>
      <p className={styles.resourceText}>{t(`docs.${doc}.desc`)}</p>
      <button
        type="button"
        className={`${styles.pillButton} ${isWord ? styles.pillButtonNeutral : ""}`}
        onClick={() => onOpen({ kind: "doc", doc })}
      >
        {t(`docs.${doc}.action`)}
      </button>
    </div>
  );
}

/** Modal reader: PDF inline, .docx rendered in the browser, the example image,
 * and a team's final deck for organizers (signed Storage links). */
export function DocViewer({
  target,
  onClose,
}: {
  target: ViewerTarget;
  onClose: () => void;
}) {
  const t = useTranslations("Dallas.resources");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  let title: string;
  let badge: string;
  let badgeClass: string;
  let file: string | null;
  /** Where Download points; differs from `file` for signed deck links. */
  let downloadHref: string | null;
  let demoLink: string | null = null;
  let emptyText: string;
  /** Lowercase file name, to pick how to show it. */
  let name: string;

  if (target.kind === "deck") {
    title = `${target.team} — ${target.file}`;
    badge = t("badges.deck");
    badgeClass = styles.badgePdf;
    file = target.viewUrl;
    downloadHref = target.downloadUrl;
    demoLink = target.demoLink;
    emptyText = t("viewer.deckNoPreview");
    // Signed URLs carry a query string, so the type comes from the file name.
    name = target.file.toLowerCase();
  } else if (target.kind === "example") {
    title = t("whiteboard.example");
    badge = t("badges.image");
    badgeClass = styles.badgeActivity;
    file = withBasePath(WHITEBOARD_EXAMPLE);
    downloadHref = file;
    emptyText = "";
    name = file.toLowerCase();
  } else {
    const doc = DOCS[target.doc];
    const isWord = doc.type === "word";
    title = t(`docs.${target.doc}.title`);
    badge = isWord ? t("badges.word") : t("badges.pdf");
    badgeClass = isWord ? styles.badgeWord : styles.badgePdf;
    file = doc.file ? withBasePath(doc.file) : null;
    downloadHref = file;
    emptyText = isWord ? t("viewer.wordSoon") : t("viewer.pdfSoon");
    name = (file ?? "").toLowerCase();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
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
            <a
              className={styles.ghostButton}
              href={demoLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("viewer.demo")}
            </a>
          )}
          {downloadHref && (
            <a className={styles.nextBtn} href={downloadHref} download>
              {t("viewer.download")}
            </a>
          )}
          <button
            type="button"
            className={styles.ghostButton}
            onClick={onClose}
            autoFocus
          >
            {t("viewer.back")}
          </button>
        </div>
        <div className={styles.viewerBody}>
          {file && name.endsWith(".pdf") ? (
            <iframe className={styles.viewerFrame} src={file} title={title} />
          ) : file && name.endsWith(".docx") ? (
            <DocxPreview key={file} file={file} />
          ) : file && /\.(png|jpe?g|webp|svg)$/.test(name) ? (
            // Static file from public/; shown at its natural ratio inside the viewer.
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.viewerImage} src={file} alt={title} />
          ) : (
            // No file yet, or a PowerPoint deck: browsers cannot show it inline.
            <div className={styles.viewerEmpty}>{emptyText}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Renders a .docx from public/ in the browser (docx-preview, loaded on demand). */
function DocxPreview({ file }: { file: string }) {
  const t = useTranslations("Dallas.resources.viewer");
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const [{ renderAsync }, response] = await Promise.all([
        import("docx-preview"),
        fetch(file),
      ]);
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
        <div className={styles.viewerEmpty}>
          {status === "loading" ? t("wordLoading") : t("wordError")}
        </div>
      )}
      <div ref={container} hidden={status !== "ready"} />
    </div>
  );
}

function WhiteboardLoading() {
  const t = useTranslations("Dallas.resources.whiteboard");
  return <div className={styles.viewerEmpty}>{t("loading")}</div>;
}

/** Full-screen Excalidraw board for the Strategize whiteboard activity. */
function WhiteboardDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Dallas.resources.whiteboard");
  const locale = useLocale();
  const handle = useRef<WhiteboardHandle | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // Lock page scroll behind the board.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

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
      link.download = "aspire-dallas-whiteboard.png";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice(t("exportError"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.whiteboard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whiteboard-title"
      >
        <div className={styles.viewerHeader}>
          <span className={`${styles.badge} ${styles.badgeActivity}`}>
            {t("badge")}
          </span>
          <div className={styles.whiteboardTitles}>
            <h2 id="whiteboard-title" className={styles.viewerTitle}>
              {t("title")}
            </h2>
            <span className={styles.whiteboardHint}>{notice ?? t("hint")}</span>
          </div>
          <button
            type="button"
            className={styles.nextBtn}
            onClick={downloadPng}
            disabled={exporting}
          >
            {exporting ? t("exporting") : t("download")}
          </button>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={onClose}
          >
            {t("close")}
          </button>
        </div>
        <div className={styles.whiteboardCanvas}>
          <WhiteboardCanvas
            storageKey={WHITEBOARD_KEY}
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
