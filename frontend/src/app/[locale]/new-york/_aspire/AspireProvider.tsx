"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PHASE_KEYS, type DocKey, type PhaseKey } from "./data";
import { fetchWithSession } from "./api";
import type { AspireViewer } from "./session";

// Where progress lived before it moved to the backend; uploaded once, then cleared.
const LEGACY_PROGRESS_KEY = "aspire.new-york.completed-phases";

/** The team's final deck, stored in the aspire-team-submissions bucket. */
export type Submission = { deck: string; link: string; submittedAt: string | null };

type ApiSubmission = { file_name: string; demo_link: string | null; submitted_at: string | null } | null;

function toSubmission(row: ApiSubmission): Submission | null {
  return row ? { deck: row.file_name, link: row.demo_link ?? "", submittedAt: row.submitted_at } : null;
}

/** What the document viewer is showing: a phase guide, or a submitted deck. */
export type ViewerTarget =
  | { kind: "doc"; doc: DocKey }
  /** A team's submitted deck, with short-lived signed Storage links (admin view). */
  | { kind: "deck"; team: string; file: string; viewUrl: string; downloadUrl: string; demoLink: string | null };

type AspireState = {
  viewer: AspireViewer;
  completed: PhaseKey[];
  togglePhase: (key: PhaseKey) => void;
  /** 0..1 — "Team setup" counts as the first of five steps. */
  progress: number;
  /** Index into PHASE_KEYS of the first unfinished phase, or -1 when all are done. */
  currentIndex: number;
  /** Signed URL of `<GROUP_CODE>.<ext>` in the aspire-group-logos bucket, or null. */
  teamLogo: string | null;
  /** Names of the viewer's team members. */
  members: string[];
  submission: Submission | null;
  /** Uploads `file` (or keeps the current deck when null) and saves the demo link. */
  submit: (file: File | null, link: string) => Promise<{ ok: true } | { ok: false; error: string | null }>;
  submitOpen: boolean;
  setSubmitOpen: (open: boolean) => void;
  openTarget: ViewerTarget | null;
  setOpenTarget: (target: ViewerTarget | null) => void;
  coachOpen: boolean;
  setCoachOpen: (open: boolean) => void;
  whiteboardOpen: boolean;
  setWhiteboardOpen: (open: boolean) => void;
};

const AspireContext = createContext<AspireState | null>(null);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function removeStorage(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage blocked (private mode): nothing to clean up.
  }
}

function toPhaseKeys(value: unknown): PhaseKey[] {
  return Array.isArray(value) ? PHASE_KEYS.filter((key) => value.includes(key)) : [];
}

/** Marks one phase for the viewer's team (/api/team/progress); returns the team's list, or null. */
async function saveProgress(phase: PhaseKey, done: boolean): Promise<PhaseKey[] | null> {
  const response = await fetchWithSession("/api/team/progress?city_code=NYC", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase, completed: done }),
  });
  if (!response?.ok) return null;
  const body = (await response.json()) as { completed?: unknown };
  return toPhaseKeys(body.completed);
}

export function AspireProvider({ viewer, children }: { viewer: AspireViewer; children: ReactNode }) {
  const [completed, setCompleted] = useState<PhaseKey[]>([]);
  const [teamLogo, setTeamLogo] = useState<string | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [openTarget, setOpenTarget] = useState<ViewerTarget | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);

  // Team progress, members, logo and submission from the backend's /api/team/*.
  useEffect(() => {
    const controller = new AbortController();

    async function fetchProgress() {
      const response = await fetchWithSession("/api/team/progress?city_code=NYC", { signal: controller.signal });
      if (!response?.ok) return null;
      const body = (await response.json()) as { completed?: unknown };
      return toPhaseKeys(body.completed);
    }

    async function loadProgress() {
      const fetched = await fetchProgress();
      if (!fetched) return;
      let saved = fetched;

      // One-time move of progress saved in this browser before the backend kept it.
      const legacy = toPhaseKeys(readJson<unknown>(LEGACY_PROGRESS_KEY, []));
      const missing = legacy.filter((key) => !saved.includes(key));
      for (const key of missing) {
        saved = (await saveProgress(key, true)) ?? saved;
      }
      if (missing.every((key) => saved.includes(key))) removeStorage(LEGACY_PROGRESS_KEY);
      if (!controller.signal.aborted) setCompleted(saved);
    }

    async function loadTeam() {
      const response = await fetchWithSession("/api/team/members?city_code=NYC", { signal: controller.signal });
      if (!response?.ok) return;
      const body = (await response.json()) as {
        logo_url?: string | null;
        members?: { name: string }[];
      };
      setTeamLogo(body.logo_url ?? null);
      setMembers((body.members ?? []).map((member) => member.name));
    }

    async function loadSubmission() {
      const response = await fetchWithSession("/api/team/submission?city_code=NYC", { signal: controller.signal });
      if (!response?.ok) return;
      const body = (await response.json()) as { submission: ApiSubmission };
      setSubmission(toSubmission(body.submission));
    }

    // Without the API the card shows the team initials and no members.
    loadProgress().catch(() => {});
    loadTeam().catch(() => {});
    loadSubmission().catch(() => {});

    // A teammate marked a phase: Realtime only delivers rows of the viewer's
    // own team (RLS), but deletes are not filtered, so always refetch rather
    // than trusting the payload. Coalesce bursts into one request.
    let refetchTimer: number | undefined;
    function refreshProgress() {
      window.clearTimeout(refetchTimer);
      refetchTimer = window.setTimeout(() => {
        fetchProgress()
          .then((saved) => {
            if (saved && !controller.signal.aborted) setCompleted(saved);
          })
          .catch(() => {});
      }, 300);
    }

    let unsubscribe = () => {};
    import("@/lib/supabase/client")
      .then(({ createClient }) => {
        if (controller.signal.aborted) return;
        const supabase = createClient();
        const channel = supabase
          .channel("aspire-team-progress")
          .on("postgres_changes", { event: "*", schema: "public", table: "aspire_team_progress" }, refreshProgress)
          .subscribe();
        unsubscribe = () => void supabase.removeChannel(channel);
      })
      .catch(() => {});
    // Also catch up after the tab was in the background (e.g. a dropped socket).
    function onVisible() {
      if (document.visibilityState === "visible") refreshProgress();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      controller.abort();
      window.clearTimeout(refetchTimer);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
    };
  }, []);

  const togglePhase = useCallback(
    (key: PhaseKey) => {
      const done = !completed.includes(key);
      const previous = completed;
      // Show the change right away; the backend's answer is the team's real list.
      setCompleted(done ? [...completed, key] : completed.filter((k) => k !== key));
      saveProgress(key, done)
        .then((saved) => setCompleted(saved ?? previous))
        .catch(() => setCompleted(previous));
    },
    [completed],
  );

  const submit = useCallback<AspireState["submit"]>(async (file, link) => {
    const params = new URLSearchParams({ city_code: "NYC" });
    if (link) params.set("demo_link", link);
    if (file) params.set("file_name", file.name);

    try {
      // The deck travels as the raw request body; an empty body only updates the link.
      const response = await fetchWithSession(`/api/team/submission?${params}`, {
        method: "POST",
        headers: { "Content-Type": file?.type || "application/octet-stream" },
        body: file ?? undefined,
      });
      if (!response) return { ok: false, error: null };
      const body = (await response.json()) as { submission?: ApiSubmission; detail?: string };
      if (!response.ok) return { ok: false, error: body.detail ?? null };
      setSubmission(toSubmission(body.submission ?? null));
      return { ok: true };
    } catch {
      return { ok: false, error: null };
    }
  }, []);

  const value = useMemo<AspireState>(() => {
    const currentIndex = PHASE_KEYS.findIndex((key) => !completed.includes(key));
    return {
      viewer,
      completed,
      togglePhase,
      progress: (1 + completed.length) / (PHASE_KEYS.length + 1),
      currentIndex,
      teamLogo,
      members,
      submission,
      submit,
      submitOpen,
      setSubmitOpen,
      openTarget,
      setOpenTarget,
      coachOpen,
      setCoachOpen,
      whiteboardOpen,
      setWhiteboardOpen,
    };
  }, [viewer, completed, togglePhase, teamLogo, members, submission, submit, submitOpen, openTarget, coachOpen, whiteboardOpen]);

  return <AspireContext.Provider value={value}>{children}</AspireContext.Provider>;
}

export function useAspire() {
  const value = useContext(AspireContext);
  if (!value) throw new Error("useAspire must be used inside AspireProvider");
  return value;
}

export function initialsOf(name: string) {
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2)).toUpperCase();
}

export function initialsFrom(email: string) {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase() || "ME";
}
