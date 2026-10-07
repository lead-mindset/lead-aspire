// Pure rules for the Dallas challenge, kept apart from the UI so they can be
// unit tested and later mirrored by the backend.

import {
  CAUSES_REQUIRED,
  DEFAULT_STRATEGY,
  MAX_CHANGES,
  PHASE_KEYS,
  RECS,
  type PhaseKey,
  type RecKey,
  type Screen,
} from "./data";

export type DallasState = {
  screen: Screen;
  done: PhaseKey[];
  members: Record<string, string>;
  briefAnswer: string;
  missing: string[];
  workload: number;
  diag: Record<string, string>;
  causes: string[];
  strategy: RecKey[];
  /** Respond's edited copy of the strategy; null until Respond is opened. */
  revised: (RecKey | "")[] | null;
  situation: string;
  rootCause: string;
  msRec: string;
  statement: string;
  outcomes: Record<string, string>;
  metrics: string[];
};

export const INITIAL_STATE: DallasState = {
  screen: "team",
  done: [],
  members: {},
  briefAnswer: "",
  missing: [],
  workload: 0,
  diag: {},
  causes: [],
  strategy: [],
  revised: null,
  situation: "",
  rootCause: "",
  msRec: "",
  statement: "",
  outcomes: {},
  metrics: [],
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

/** The strategy Respond revises: the team's own, or a default when Advise was skipped. */
export function baseStrategy(s: Pick<DallasState, "strategy">): RecKey[] {
  return s.strategy.length ? s.strategy : DEFAULT_STRATEGY;
}

/** Number of positions where the revised strategy differs from the base one. */
export function countChanges(
  base: readonly string[],
  revised: readonly string[],
): number {
  return revised.filter((value, i) => value !== base[i]).length;
}

/** Applies one Respond edit, or returns null when it would exceed the change limit. */
export function reviseAt(
  base: readonly RecKey[],
  revised: readonly (RecKey | "")[],
  index: number,
  value: RecKey | "",
): (RecKey | "")[] | null {
  const next = [...revised];
  next[index] = value;
  return countChanges(base, next) > MAX_CHANGES ? null : next;
}

export type BlockReason = "team" | "brief" | "diagnose" | "advise" | "deliver";

/** Why the team can't continue from `screen` yet, or null when it can. */
export function blockReason(
  screen: Screen,
  s: DallasState,
): BlockReason | null {
  switch (screen) {
    case "team":
      return Object.values(s.members).some(Boolean) ? null : "team";
    case "brief":
      return s.briefAnswer.trim() ? null : "brief";
    case "diagnose":
      return s.causes.length === CAUSES_REQUIRED ? null : "diagnose";
    case "advise":
      return s.strategy.length > 0 ? null : "advise";
    case "deliver":
      return s.situation.trim() && s.msRec.trim() && s.statement.trim()
        ? null
        : "deliver";
    default:
      return null;
  }
}

/** The screen after `phase`: the next phase, or the results after Deliver. */
export function nextScreen(phase: PhaseKey): Screen {
  const i = PHASE_KEYS.indexOf(phase);
  return i < PHASE_KEYS.length - 1 ? PHASE_KEYS[i + 1] : "results";
}
