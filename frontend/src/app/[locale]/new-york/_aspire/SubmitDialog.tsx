"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAspire } from "./AspireProvider";
import styles from "./aspire.module.css";

const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPTED = /\.(pdf|ppt|pptx)$/i;

/** Final deck submission: uploads the deck to Supabase Storage through the backend. */
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !pending && setSubmitOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, setSubmitOpen]);

  function chooseFile(next: File | undefined) {
    setError(null);
    if (!next) return;
    if (!ACCEPTED.test(next.name)) {
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
    setPending(true);
    setError(null);
    const result = await submit(file, link.trim());
    setPending(false);
    if (result.ok) setSubmitOpen(false);
    else setError(result.error ?? t("errors.generic"));
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
            accept=".ppt,.pptx,.pdf"
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
