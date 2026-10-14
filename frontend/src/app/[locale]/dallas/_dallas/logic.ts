// Pure rules for the Dallas challenge, kept apart from the UI so they can be
// unit tested. The Continue rules are mirrored by the backend
// (backend/app/dallas_challenge.py, COMPLETE_RULES).

import {
  PHASE_KEYS,
  RECS,
  type PhaseKey,
  type RecKey,
  type Screen,
} from "./data";

/** The team's shared answers (saved per phase, see answers.ts). */
export type DallasState = {
  /** The team's display name; "" until set. */
  teamName: string;
  /** Role key -> the user_id of the member who has it. */
  members: Record<string, string>;
  /** Strategize > Diagnose: workload key -> class key. */
  diag: Record<string, string>;
  /** Strategize > Diagnose: the chosen root causes. */
  causes: string[];
  /** Strategize > Advise: recommendations, in the order they were added. */
  strategy: RecKey[];
};

export const INITIAL_STATE: DallasState = {
  teamName: "",
  members: {},
  diag: {},
  causes: [],
  strategy: [],
};

/** Adds or removes `value`; adding is ignored once the list holds `max`. */
export function toggleLimited<T>(list: T[], value: T, max?: number): T[] {
  if (list.includes(value)) return list.filter((item) => item !== value);
  if (max !== undefined && list.length >= max) return list;
  return [...list, value];
}

export type TimeLevel = "short" | "medium" | "long";

/** Summed effects of the chosen recommendations and how long the slowest one takes. */
export function projectImpact(strategy: RecKey[]): {
  fx: [number, number, number, number];
  time: TimeLevel | null;
} {
  const fx: [number, number, number, number] = [0, 0, 0, 0];
  let maxWeeks = 0;
  for (const key of strategy) {
    RECS[key].fx.forEach((value, i) => (fx[i] += value));
    maxWeeks = Math.max(maxWeeks, RECS[key].weeks);
  }
  const time =
    strategy.length === 0
      ? null
      : maxWeeks <= 4
        ? "short"
        : maxWeeks <= 8
          ? "medium"
          : "long";
  return { fx, time };
}

export type BlockReason = "team";

/** Why the team can't continue from `screen` yet, or null when it can. */
export function blockReason(
  screen: Screen,
  s: DallasState,
): BlockReason | null {
  if (screen === "team") {
    return s.teamName.trim() && Object.values(s.members).some(Boolean)
      ? null
      : "team";
  }
  return null;
}

/** The first phase the team has not completed, or null when all are done. */
export function firstOpenPhase(done: readonly PhaseKey[]): PhaseKey | null {
  return PHASE_KEYS.find((key) => !done.includes(key)) ?? null;
}

/** The screen after `phase`: the next phase, or Home after Pitch & Submit. */
export function nextScreen(phase: PhaseKey): Screen {
  const i = PHASE_KEYS.indexOf(phase);
  return i < PHASE_KEYS.length - 1 ? PHASE_KEYS[i + 1] : "home";
}
