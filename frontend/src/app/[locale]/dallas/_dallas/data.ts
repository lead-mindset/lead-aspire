// Structure for the Dallas Aspire app (design: dallas-mockup-v2). Case
// content is moving to content.ts (phases and roles are there already); the
// rest still lives here and in messages under "Dallas" until Stages B and C.
// The leaderboard is still mock.

/** Team Setup comes first but is not a numbered step: Discover is Step 1. */
export const PHASE_KEYS = [
  "team",
  "discover",
  "strategize",
  "design",
  "pitch",
] as const;
export type PhaseKey = (typeof PHASE_KEYS)[number];
/** "teams": the organizer "View Teams Results" screen (admins only). */
export type Screen = "home" | PhaseKey | "teams";

/** "Step N" of a phase; null for Team Setup. */
export function stepNumber(phase: PhaseKey): number | null {
  const i = PHASE_KEYS.indexOf(phase);
  return i > 0 ? i : null;
}

export type ValueLevel = "high" | "medium" | "low" | "unknown";

export const KPIS = [
  { key: "tokens", value: "27M", tone: "bad" },
  { key: "cost", value: "$54K", tone: "bad" },
  { key: "adoption", value: "68%", tone: "good" },
  { key: "workloads", value: "6", tone: "neutral" },
] as const;

/** Discover > AI Dashboard trend: monthly tokens, in millions (Jan-Jun 2024). */
export const TOKEN_TREND = [9.5, 12.1, 15.4, 19.6, 22.3, 27] as const;
export const TOKEN_TREND_MAX = 30;

export const WORKLOAD_KEYS = [
  "support",
  "sales",
  "marketing",
  "hr",
  "knowledge",
  "experiments",
] as const;
export type WorkloadKey = (typeof WORKLOAD_KEYS)[number];

export const WORKLOADS: Record<
  WorkloadKey,
  {
    tokens: string;
    cost: string;
    adoption: string;
    value: ValueLevel;
    model: string;
    notes: number;
  }
> = {
  support: {
    tokens: "10.2M",
    cost: "$20K",
    adoption: "91%",
    value: "high",
    model: "GPT-4o",
    notes: 4,
  },
  sales: {
    tokens: "4.1M",
    cost: "$8K",
    adoption: "82%",
    value: "high",
    model: "GPT-4o mini",
    notes: 3,
  },
  marketing: {
    tokens: "5.0M",
    cost: "$10K",
    adoption: "71%",
    value: "medium",
    model: "GPT-4o + DALL·E",
    notes: 3,
  },
  hr: {
    tokens: "2.8M",
    cost: "$6K",
    adoption: "23%",
    value: "low",
    model: "GPT-4o",
    notes: 3,
  },
  knowledge: {
    tokens: "4.5M",
    cost: "$9K",
    adoption: "64%",
    value: "unknown",
    model: "GPT-4o",
    notes: 3,
  },
  experiments: {
    tokens: "1.4M",
    cost: "$3K",
    adoption: "N/A",
    value: "unknown",
    model: "Mixed",
    notes: 3,
  },
};

// Strategize > Diagnose and Advise: practice activities for brainstorming,
// not graded. Saved for the team under the Strategize phase (answers.ts).

export const CLASS_KEYS = [
  "protect",
  "optimize",
  "investigate",
  "retire",
] as const;
export type ClassKey = (typeof CLASS_KEYS)[number];

export const CLASS_COLORS: Record<ClassKey, string> = {
  protect: "oklch(0.65 0.15 155)",
  optimize: "var(--brand-purple)",
  investigate: "oklch(0.75 0.14 70)",
  retire: "var(--brand-red)",
};

export const CAUSE_KEYS = [
  "adoption",
  "models",
  "prompts",
  "duplicates",
  "governance",
  "experiments",
  "monitoring",
  "training",
  "value",
  "capacity",
] as const;
/** Diagnose: how many root causes a team can pick. */
export const CAUSES_MAX = 3;

export const REC_KEYS = ["mon", "opt", "exp", "hr", "gov", "trn"] as const;
export type RecKey = (typeof REC_KEYS)[number];

/**
 * `weeks` sizes the implementation time; `fx` is the effect on
 * [operating cost, business value, adoption, security risk] in percent.
 */
export const RECS: Record<
  RecKey,
  { cost: string; weeks: number; fx: [number, number, number, number] }
> = {
  mon: { cost: "$$", weeks: 5, fx: [4, 2, 0, 5] },
  opt: { cost: "$$", weeks: 8, fx: [9, 4, 1, 0] },
  exp: { cost: "$$$", weeks: 10, fx: [-3, 9, 4, 0] },
  hr: { cost: "$", weeks: 3, fx: [5, 2, 1, 3] },
  gov: { cost: "$$", weeks: 8, fx: [1, 2, 0, 12] },
  trn: { cost: "$$", weeks: 5, fx: [0, 3, 7, 5] },
};

/** Advise: the most recommendations a strategy can hold. */
export const STRATEGY_MAX = 5;

