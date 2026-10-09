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

/** The shared part of DallasState: everything except `workload`. */
export type SharedState = Omit<DallasState, "workload">;

const SLOT_COUNT = 9;

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

function mapOf(answers: Answers, prefix: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (key.startsWith(prefix) && typeof value === "string" && value) {
      map[key.slice(prefix.length)] = value;
    }
  }
  return map;
}

/** Outcomes keep "" (ticked, no target yet), so only null/absent means unticked. */
function outcomesOf(answers: Answers): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (key.startsWith("outcome_") && typeof value === "string") {
      map[key.slice("outcome_".length)] = value;
    }
  }
  return map;
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

function revisedOf(answers: Answers): (RecKey | "")[] | null {
  const slots: (RecKey | "")[] = [];
  for (let i = 1; i <= SLOT_COUNT; i++) {
    const value = answers[`slot_${i}`];
    if (typeof value !== "string") break;
    slots.push(value as RecKey | "");
  }
  return slots.length ? slots : null;
}

export function emptyAnswers(): PhaseAnswers {
  return Object.fromEntries(PHASE_KEYS.map((key) => [key, {}])) as PhaseAnswers;
}

/** The views' state from the team's saved answers. */
export function fromAnswers(all: PhaseAnswers): SharedState {
  const { team, brief, diagnose, advise, respond, deliver } = all;
  return {
    teamName: text(team.display_name),
    members: mapOf(team, "role_"),
    briefAnswer: text(brief.q1),
    missing: optionsOf(brief, "missing_"),
    diag: mapOf(diagnose, "class_"),
    causes: optionsOf(diagnose, "cause_"),
    strategy: strategyOf(advise),
    revised: revisedOf(respond),
    situation: text(deliver.situation),
    rootCause: text(deliver.root_cause),
    msRec: text(deliver.ms_rec),
    statement: text(deliver.statement),
    outcomes: outcomesOf(deliver),
    metrics: optionsOf(deliver, "metric_"),
  };
}

function setPatch(prefix: string, before: string[], after: string[]): Answers {
  const patch: Answers = {};
  for (const option of after)
    if (!before.includes(option)) patch[prefix + option] = true;
  for (const option of before)
    if (!after.includes(option)) patch[prefix + option] = null;
  return patch;
}

function mapPatch(
  prefix: string,
  before: Record<string, string>,
  after: Record<string, string>,
): Answers {
  const patch: Answers = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    // "" (e.g. "Assign member…") clears the key like a removal does.
    if (before[key] !== after[key]) patch[prefix + key] = after[key] || null;
  }
  return patch;
}

function outcomePatch(
  before: Record<string, string>,
  after: Record<string, string>,
): Answers {
  const patch: Answers = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[key] !== after[key])
      patch[`outcome_${key}`] = key in after ? after[key] : null;
  }
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

function revisedPatch(
  before: (RecKey | "")[] | null,
  after: (RecKey | "")[] | null,
): Answers {
  const patch: Answers = {};
  const length = Math.max(before?.length ?? 0, after?.length ?? 0);
  for (let i = 0; i < Math.min(length, SLOT_COUNT); i++) {
    const value = after && i < after.length ? after[i] : null;
    const old = before && i < before.length ? before[i] : null;
    if (value !== old) patch[`slot_${i + 1}`] = value;
  }
  return patch;
}

function textPatch(patch: Answers, key: string, before: string, after: string) {
  if (before !== after) patch[key] = after === "" ? null : after;
}

/** The keys that changed between two states, grouped by phase. Empty phases are left out. */
export function toPatches(
  before: SharedState,
  after: SharedState,
  now = Date.now(),
): Patches {
  const team: Answers = mapPatch("role_", before.members, after.members);
  textPatch(team, "display_name", before.teamName, after.teamName);

  const brief: Answers = setPatch("missing_", before.missing, after.missing);
  textPatch(brief, "q1", before.briefAnswer, after.briefAnswer);

  const diagnose: Answers = {
    ...mapPatch("class_", before.diag, after.diag),
    ...setPatch("cause_", before.causes, after.causes),
  };
  const advise = strategyPatch(before.strategy, after.strategy, now);
  const respond = revisedPatch(before.revised, after.revised);

  const deliver: Answers = {
    ...outcomePatch(before.outcomes, after.outcomes),
    ...setPatch("metric_", before.metrics, after.metrics),
  };
  textPatch(deliver, "situation", before.situation, after.situation);
  textPatch(deliver, "root_cause", before.rootCause, after.rootCause);
  textPatch(deliver, "ms_rec", before.msRec, after.msRec);
  textPatch(deliver, "statement", before.statement, after.statement);

  const patches: Patches = {};
  for (const [phase, patch] of Object.entries({
    team,
    brief,
    diagnose,
    advise,
    respond,
    deliver,
  })) {
    if (Object.keys(patch).length) patches[phase as PhaseKey] = patch;
  }
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
