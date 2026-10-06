"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAspire, type SubmitStep } from "./AspireProvider";
import styles from "./aspire.module.css";

const MAX_BYTES = 50 * 1024 * 1024;
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
// Browsers report "" or a generic type when they can't tell; the extension decides then.
const UNKNOWN_TYPES = ["", "application/octet-stream"];

/** Same rule as the backend: a known extension, and a browser type that doesn't contradict it. */
function isAcceptedDeck(file: File) {
  const expected = TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""];
  return Boolean(expected) && (UNKNOWN_TYPES.includes(file.type) || file.type === expected);
}

type Status = "idle" | SubmitStep | "done";

/** Final deck submission: the backend signs an upload, the browser uploads straight to Supabase Storage. */
export function SubmitDialog() {
  const { submitOpen } = useAspire();
  // Mounted only while open, so the form starts from the saved submission.
  return submitOpen ? <SubmitForm /> : null;
}

function SubmitForm() {
  const t = useTranslations("Aspire.submitDialog");
  const { viewer, submission, submit, setSubmitOpen } = useAspire();
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState(submission?.link ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const pending = status !== "idle" && status !== "done";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !pending && setSubmitOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, setSubmitOpen]);

  function chooseFile(next: File | undefined) {
    setError(null);
    if (!next) return;
    if (!isAcceptedDeck(next)) {
      setError(t("errors.type"));
      return;
    }
    if (next.size > MAX_BYTES) {
      setError(t("errors.size"));
      return;
    }
    setFile(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file && !submission) return;
    setError(null);
    const result = await submit(file, link.trim(), setStatus);
    if (result.ok) {
      setStatus("done");
      return;
    }
    setStatus("idle");
    setError(result.error ?? t(`errors.${result.step}`));
  }

  if (status === "done") {
    return (
      <div className={styles.overlay} onClick={() => setSubmitOpen(false)}>
        <div
          className={styles.submitForm}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-title"
        >
          <div className={styles.submitHead}>
            <h2 id="submit-title" className={styles.submitTitle}>
              {t("successTitle")}
            </h2>
            <p className={styles.submitIntro} role="status">
              {t("success", { team: viewer.teamName ?? t("teamFallback") })}
            </p>
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.ctaButton} onClick={() => setSubmitOpen(false)} autoFocus>
              {t("close")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const deckLabel = file?.name ?? submission?.deck;

  return (
    <div className={styles.overlay} onClick={() => !pending && setSubmitOpen(false)}>
      <form
        className={styles.submitForm}
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-title"
      >
        <div className={styles.submitHead}>
          <h2 id="submit-title" className={styles.submitTitle}>
            {t("title")}
          </h2>
          <p className={styles.submitIntro}>{t("intro", { team: viewer.teamName ?? t("teamFallback") })}</p>
        </div>
        <label className={styles.dropzone}>
          <input
            type="file"
            accept={`.ppt,.pptx,.pdf,${Object.values(TYPES).join(",")}`}
            disabled={pending}
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
          <b className={styles.dropzoneLabel}>{deckLabel ?? t("drop")}</b>
          <span className={styles.dropzoneHint}>
            {submission && !file ? t("replaceHint") : t("dropHint")}
          </span>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("demoLabel")} <span>{t("optional")}</span>
          </span>
          <input
            className={styles.fieldInput}
            type="url"
            value={link}
            disabled={pending}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://"
          />
        </label>
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : pending ? (
          <p className={styles.previewNote} role="status">
            {t(`status.${status}`)}
          </p>
        ) : (
          <p className={styles.previewNote}>{t("note")}</p>
        )}
        <div className={styles.modalActions}>
          <button type="button" className={styles.ghostButton} onClick={() => setSubmitOpen(false)} disabled={pending}>
            {t("cancel")}
          </button>
          <button type="submit" className={styles.ctaButton} disabled={pending || (!file && !submission)}>
            {pending ? t("uploading") : t("submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
