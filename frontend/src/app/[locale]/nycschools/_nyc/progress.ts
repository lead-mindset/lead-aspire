"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { STEP_KEYS, type StepKey } from "./data";

// No sign-in for this lab: completed steps live in this browser only.
const STORAGE_KEY = "nycschools.completed-steps";

const listeners = new Set<() => void>();
// Used when storage is blocked, so progress still works for this page view.
let memory = "[]";

function read(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? memory;
  } catch {
    return memory;
  }
}

function write(value: string) {
  memory = value;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage blocked: keep the in-memory copy.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function parse(raw: string): StepKey[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? STEP_KEYS.filter((key) => value.includes(key)) : [];
  } catch {
    return [];
  }
}

export function useLabProgress() {
  // The server renders with nothing completed; the browser fills it in.
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const completed = useMemo(() => parse(raw), [raw]);

  const toggleStep = useCallback((key: StepKey) => {
    const current = parse(read());
    write(JSON.stringify(current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  }, []);

  /** Index into STEP_KEYS of the first unfinished step, or -1 when all are done. */
  const currentIndex = STEP_KEYS.findIndex((key) => !completed.includes(key));

  return { completed, toggleStep, currentIndex, progress: completed.length / STEP_KEYS.length };
}
