// The team's saved answers <-> the state the views use.
//
// The backend stores one flat object per phase, one key per field or option,
// so two students editing different things at once keep both edits (see
// backend/app/dallas_challenge.py). The views keep their natural shapes
// (lists, maps); this file converts between the two and turns a view edit
// into a patch of only the keys that changed. A null removes a key.

import { PHASE_KEYS, type PhaseKey, type RecKey } from "./data";
import type { DallasState } from "./logic";

export type Answers = Record<string, unknown>;
export type PhaseAnswers = Record<PhaseKey, Answers>;
export type Patches = Partial<Record<PhaseKey, Answers>>;

/** Everything the views edit is shared with the team. */
export type SharedState = DallasState;

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Keys `prefix<option>` whose value is set, as options. */
function optionsOf(answers: Answers, prefix: string): string[] {
  return Object.keys(answers)
    .filter(
      (key) =>
        key.startsWith(prefix) &&
        answers[key] != null &&
        answers[key] !== false,
    )
    .map((key) => key.slice(prefix.length))
    .sort();
}

/** The strategy, in the order the recommendations were added. */
function strategyOf(answers: Answers): RecKey[] {
  return Object.entries(answers)
    .filter(
      ([key, value]) => key.startsWith("rec_") && typeof value === "number",
    )
    .sort(
      ([a, x], [b, y]) => (x as number) - (y as number) || a.localeCompare(b),
    )
    .map(([key]) => key.slice("rec_".length) as RecKey);
}

function mapOf(answers: Answers, prefix: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (key.startsWith(prefix) && typeof value === "string" && value) {
      map[key.slice(prefix.length)] = value;
    }
  }
  return map;
}

export function emptyAnswers(): PhaseAnswers {
  return Object.fromEntries(PHASE_KEYS.map((key) => [key, {}])) as PhaseAnswers;
}

/** The views' state from the team's saved answers. */
export function fromAnswers(all: PhaseAnswers): SharedState {
  const { team, strategize } = all;
  return {
    teamName: text(team.display_name),
    members: mapOf(team, "role_"),
    diag: mapOf(strategize, "class_"),
    causes: optionsOf(strategize, "cause_"),
    strategy: strategyOf(strategize),
  };
}

function mapPatch(
  prefix: string,
  before: Record<string, string>,
  after: Record<string, string>,
): Answers {
  const patch: Answers = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    // "" (e.g. "Select teammate") clears the key like a removal does.
    if (before[key] !== after[key]) patch[prefix + key] = after[key] || null;
  }
  return patch;
}

function setPatch(prefix: string, before: string[], after: string[]): Answers {
  const patch: Answers = {};
  for (const option of after)
    if (!before.includes(option)) patch[prefix + option] = true;
  for (const option of before)
    if (!after.includes(option)) patch[prefix + option] = null;
  return patch;
}

/** Added recommendations get the time they were added (it orders the strategy). */
function strategyPatch(
  before: RecKey[],
  after: RecKey[],
  now: number,
): Answers {
  const patch: Answers = {};
  after.forEach((key, i) => {
    if (!before.includes(key)) patch[`rec_${key}`] = now + i;
  });
  for (const key of before)
    if (!after.includes(key)) patch[`rec_${key}`] = null;
  return patch;
}

/** The keys that changed between two states, grouped by phase. Empty phases are left out. */
export function toPatches(
  before: SharedState,
  after: SharedState,
  now = Date.now(),
): Patches {
  const team: Answers = mapPatch("role_", before.members, after.members);
  if (before.teamName !== after.teamName) {
    team.display_name = after.teamName === "" ? null : after.teamName;
  }
  const strategize: Answers = {
    ...mapPatch("class_", before.diag, after.diag),
    ...setPatch("cause_", before.causes, after.causes),
    ...strategyPatch(before.strategy, after.strategy, now),
  };

  const patches: Patches = {};
  if (Object.keys(team).length) patches.team = team;
  if (Object.keys(strategize).length) patches.strategize = strategize;
  return patches;
}

/** Saved answers with unsaved local edits on top; null removes a key. */
export function overlay(saved: Answers, pending: Answers | undefined): Answers {
  if (!pending) return saved;
  const merged: Answers = { ...saved, ...pending };
  for (const [key, value] of Object.entries(merged))
    if (value === null) delete merged[key];
  return merged;
}
