"use client";

// The team's shared state, kept in sync with /api/dallas/team/*:
// - edits are saved after a short pause, sending only the changed keys;
// - teammates' edits arrive by refetching on focus and every 25 seconds
//   (no Realtime); unsaved local edits stay on top of what arrives;
// - timers use the server's clock (`server_time`), not the laptop's.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { withBasePath } from "@/lib/basePath";
import { createClient } from "@/lib/supabase/client";
import {
  emptyAnswers,
  fromAnswers,
  overlay,
  type Answers,
  type Patches,
  type PhaseAnswers,
} from "./answers";
import { PHASE_KEYS, type PhaseKey } from "./data";
import { API_URL } from "./student";

export type PhaseState = {
  answers: Answers;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
};

export type TeamMember = {
  user_id: string;
  first_name: string;
  last_name: string;
};

export type TeamState = {
  team: {
    id: number;
    number: number;
    name: string;
    display_name: string | null;
  };
  members: TeamMember[];
  phases: Record<PhaseKey, PhaseState>;
  server_time: string;
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 800;
const REFETCH_MS = 25_000;
const RETRY_MS = 3_000;

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(`${API_URL}/api/dallas/team${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) {
    // Session gone or not a Dallas student any more: back to the Dallas login.
    window.location.assign(withBasePath("/dallas/login"));
    throw new ApiError(response.status, "signed out");
  }
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const parsed = (await response.json()) as { detail?: unknown };
      if (typeof parsed.detail === "string") detail = parsed.detail;
    } catch {
      // Not JSON: keep the status text.
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export function useTeamSync(initial: TeamState) {
  const [server, setServer] = useState(initial);
  const [pending, setPending] = useState<Patches>({});
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const pendingRef = useRef<Patches>({});
  // Server clock minus this browser's clock, in ms (set after mount).
  const offsetRef = useRef(0);
  // Bumped after every save, so a refetch that started before it is ignored.
  const saveGenRef = useRef(0);
  const inflightRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The latest flush, for the retry it schedules for itself.
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const openedRef = useRef(new Set<PhaseKey>());

  const noteServerTime = (serverTime: string) => {
    offsetRef.current = Date.parse(serverTime) - Date.now();
  };

  const applyPhase = useCallback((phase: PhaseKey, state: PhaseState) => {
    setServer((s) => ({
      ...s,
      phases: { ...s.phases, [phase]: state },
      team:
        phase === "team"
          ? {
              ...s.team,
              display_name:
                (state.answers.display_name as string | undefined) ?? null,
            }
          : s.team,
    }));
  }, []);

  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timerRef.current);
    const batch = Object.entries(pendingRef.current) as [PhaseKey, Answers][];
    if (!batch.length) return true;

    setStatus("saving");
    inflightRef.current += 1;
    let ok = true;
    await Promise.all(
      batch.map(async ([phase, sent]) => {
        let drop = false;
        try {
          const result = await call<{ phase: PhaseState; server_time: string }>(
            "POST",
            `/phases/${phase}/answers`,
            { patch: sent },
          );
          noteServerTime(result.server_time);
          applyPhase(phase, result.phase);
          drop = true;
        } catch (failure) {
          ok = false;
          const status = failure instanceof ApiError ? failure.status : 0;
          // 409/422 will never succeed (e.g. the name is locked): drop those keys.
          drop = status === 409 || status === 422;
          setError(failure instanceof ApiError ? failure.message : null);
        }
        if (drop) {
          // Keep keys edited again while this save was in flight.
          const current = { ...(pendingRef.current[phase] ?? {}) };
          for (const [key, value] of Object.entries(sent)) {
            if (current[key] === value) delete current[key];
          }
          const next = { ...pendingRef.current };
          if (Object.keys(current).length) next[phase] = current;
          else delete next[phase];
          pendingRef.current = next;
        }
      }),
    );
    saveGenRef.current += 1;
    inflightRef.current -= 1;
    setPending(pendingRef.current);
    if (ok) setError(null);
    setStatus(ok ? "saved" : "error");
    if (Object.keys(pendingRef.current).length) {
      timerRef.current = setTimeout(
        () => void flushRef.current(),
        ok ? SAVE_DELAY_MS : RETRY_MS,
      );
    }
    return ok;
  }, [applyPhase]);

  /** Record local edits and save them after a short pause. */
  const edit = useCallback(
    (patches: Patches) => {
      const next = { ...pendingRef.current };
      for (const [phase, patch] of Object.entries(patches) as [
        PhaseKey,
        Answers,
      ][]) {
        next[phase] = { ...(next[phase] ?? {}), ...patch };
      }
      pendingRef.current = next;
      setPending(next);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  const refetch = useCallback(async () => {
    if (inflightRef.current) return;
    const generation = saveGenRef.current;
    try {
      const fresh = await call<TeamState>("GET", "/state");
      // A save finished meanwhile: this state may predate it, wait for the next one.
      if (generation !== saveGenRef.current || inflightRef.current) return;
      noteServerTime(fresh.server_time);
      setServer(fresh);
    } catch {
      // Offline or the API restarted: the next tick tries again.
    }
  }, []);

  /** Start the phase timer for the team (the server keeps the first start). */
  const open = useCallback(
    async (phase: PhaseKey) => {
      if (openedRef.current.has(phase)) return;
      openedRef.current.add(phase);
      try {
        const result = await call<{ phase: PhaseState; server_time: string }>(
          "POST",
          `/phases/${phase}/open`,
        );
        noteServerTime(result.server_time);
        applyPhase(phase, result.phase);
      } catch {
        openedRef.current.delete(phase);
      }
    },
    [applyPhase],
  );

  /** Save, then mark the phase complete. Returns null, or why it was refused. */
  const complete = useCallback(
    async (phase: PhaseKey): Promise<string | null> => {
      if (!(await flush())) return "save";
      try {
        const result = await call<{ phase: PhaseState; server_time: string }>(
          "POST",
          `/phases/${phase}/complete`,
        );
        applyPhase(phase, result.phase);
        return null;
      } catch (failure) {
        return failure instanceof ApiError ? failure.message : "network";
      }
    },
    [applyPhase, flush],
  );

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void refetch();
      // Leaving the tab: save what is pending now instead of after the pause.
      else void flush();
    };
    const id = setInterval(() => void refetch(), REFETCH_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [flush, refetch]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    offsetRef.current = Date.parse(initial.server_time) - Date.now();
  }, [initial.server_time]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const answers = useMemo(() => {
    const all = emptyAnswers();
    for (const phase of PHASE_KEYS) {
      all[phase] = overlay(server.phases[phase]?.answers ?? {}, pending[phase]);
    }
    return all as PhaseAnswers;
  }, [server, pending]);

  const shared = useMemo(() => fromAnswers(answers), [answers]);
  const done = useMemo(
    () => PHASE_KEYS.filter((phase) => server.phases[phase]?.completed_at),
    [server],
  );

  return {
    server,
    shared,
    done,
    status,
    error,
    hasPending: Object.keys(pending).length > 0,
    edit,
    open,
    complete,
    /** Now, on the server's clock (ms). */
    serverNow: () => Date.now() + offsetRef.current,
  };
}
