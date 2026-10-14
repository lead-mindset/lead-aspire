"use client";

// Pitch & Submit: the team's final deck, copied from New York
// (new-york/_aspire/SubmitDialog.tsx and AspireProvider's submit) onto the
// Dallas endpoints, /api/dallas/team/submission/* (backend
// app/dallas_submission.py). The backend signs one upload path, the browser
// uploads straight to Supabase Storage, then the backend confirms it.

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { API_URL } from "./student";
import styles from "./dallas.module.css";

export type Submission = { deck: string; link: string };

type ApiSubmission = { file_name: string; demo_link: string | null } | null;

type SubmitStep = "prepare" | "upload" | "confirm";

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
  return (
    Boolean(expected) &&
    (UNKNOWN_TYPES.includes(file.type) || file.type === expected)
  );
}

function toSubmission(row: ApiSubmission | undefined): Submission | null {
  return row ? { deck: row.file_name, link: row.demo_link ?? "" } : null;
}

async function request(path: string, body?: unknown): Promise<Response> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  return fetch(`${API_URL}/api/dallas/team/submission${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
}

/** The team's saved deck (null before the first submission or without the API). */
export function useSubmission(enabled: boolean) {
  const [submission, setSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    request("")
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as { submission?: ApiSubmission };
        if (!cancelled) setSubmission(toSubmission(body.submission));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return [submission, setSubmission] as const;
}

async function submitDeck(
  file: File | null,
  link: string,
  onStep: (step: SubmitStep) => void,
): Promise<
  | { ok: true; submission: Submission | null }
  | { ok: false; step: SubmitStep; error: string | null }
> {
  let step: SubmitStep = "prepare";
  try {
    // 1. The backend checks the team, type and size and signs one upload path.
    let path: string | null = null;
    if (file) {
      onStep(step);
      const response = await request("/upload-url", {
        file_name: file.name,
        size: file.size,
        content_type: file.type,
        demo_link: link || null,
      });
      const body = (await response.json()) as {
        bucket?: string;
        path?: string;
        token?: string;
        content_type?: string;
        detail?: string;
      };
      if (!response.ok || !body.bucket || !body.path || !body.token) {
        return { ok: false, step, error: body.detail ?? null };
      }

      // 2. The file goes straight to Supabase Storage, never through the backend.
      step = "upload";
      onStep(step);
      // Browsers sometimes leave PowerPoint's type empty: use the server's.
      const labeled = new File([file], file.name, { type: body.content_type });
      const { error } = await createClient()
        .storage.from(body.bucket)
        .uploadToSignedUrl(body.path, body.token, labeled);
      if (error) return { ok: false, step, error: null };
      path = body.path;
    }

    // 3. The backend checks the stored file and saves it (or only the link).
    step = "confirm";
    onStep(step);
    const response = await request("/confirm", {
      path,
      file_name: file?.name ?? null,
      demo_link: link || null,
    });
    const body = (await response.json()) as {
      submission?: ApiSubmission;
      detail?: string;
    };
    if (!response.ok) return { ok: false, step, error: body.detail ?? null };
    return { ok: true, submission: toSubmission(body.submission) };
  } catch {
    return { ok: false, step, error: null };
  }
}

type Status = "idle" | SubmitStep | "done";

/** Upload dialog: mounted only while open, so it starts from the saved submission. */
export function SubmitDialog({
  teamName,
  submission,
  onSaved,
  onClose,
}: {
  teamName: string | null;
  submission: Submission | null;
  onSaved: (submission: Submission | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Dallas.resources.submitDialog");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState(submission?.link ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const pending = status !== "idle" && status !== "done";
  const team = teamName ?? t("teamFallback");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) =>
      event.key === "Escape" && !pending && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, onClose]);

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
    const result = await submitDeck(file, link.trim(), setStatus);
    if (result.ok) {
      onSaved(result.submission);
      setStatus("done");
      return;
    }
    setStatus("idle");
    setError(result.error ?? t(`errors.${result.step}`));
  }

  if (status === "done") {
    return (
      <div className={styles.overlay} onClick={onClose}>
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
              {t("success", { team })}
            </p>
          </div>
          <div className={styles.submitActions}>
            <button
              type="button"
              className={styles.nextBtn}
              onClick={onClose}
              autoFocus
            >
              {t("close")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const deckLabel = file?.name ?? submission?.deck;

  return (
    <div className={styles.overlay} onClick={() => !pending && onClose()}>
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
          <p className={styles.submitIntro}>{t("intro", { team })}</p>
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
        <label className={styles.submitField}>
          <span className={styles.submitFieldLabel}>
            {t("demoLabel")} <span>{t("optional")}</span>
          </span>
          <input
            className={styles.submitFieldInput}
            type="url"
            value={link}
            disabled={pending}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://"
          />
        </label>
        {error ? (
          <p className={styles.submitError} role="alert">
            {error}
          </p>
        ) : pending ? (
          <p className={styles.submitNote} role="status">
            {t(`status.${status}`)}
          </p>
        ) : (
          <p className={styles.submitNote}>{t("note")}</p>
        )}
        <div className={styles.submitActions}>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={onClose}
            disabled={pending}
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            className={styles.nextBtn}
            disabled={pending || (!file && !submission)}
          >
            {pending ? t("uploading") : t("submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
