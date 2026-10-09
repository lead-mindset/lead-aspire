// Structure for the Dallas Aspire app (design: dallas-mockup-v2). Case
// content is moving to content.ts (phases and roles are there already); the
// rest still lives here and in messages under "Dallas" until Stages B and C.
// The leaderboard is still mock.

export const PHASE_KEYS = [
  "team",
  "brief",
  "discover",
  "diagnose",
  "advise",
  "respond",
  "deliver",
] as const;
export type PhaseKey = (typeof PHASE_KEYS)[number];
export type Screen = "home" | PhaseKey | "results";

const PURPLE = "var(--brand-purple)";
const RED = "var(--brand-red)";

export const MISSING_KEYS = [
  "usage",
  "cost",
  "roi",
  "adoption",
  "security",
  "models",
] as const;
export const MISSING_MAX = 3;

export type ValueLevel = "high" | "medium" | "low" | "unknown";

export const KPIS = [
  { key: "tokens", value: "27M", tone: "bad" },
  { key: "cost", value: "$54K", tone: "bad" },
  { key: "adoption", value: "68%", tone: "good" },
  { key: "workloads", value: "6", tone: "neutral" },
] as const;

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

export const CLASS_KEYS = [
  "protect",
  "optimize",
  "investigate",
  "retire",
] as const;
export type ClassKey = (typeof CLASS_KEYS)[number];

export const CLASS_COLORS: Record<ClassKey, string> = {
  protect: "oklch(0.65 0.15 155)",
  optimize: PURPLE,
  investigate: "oklch(0.75 0.14 70)",
  retire: RED,
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
export const CAUSES_REQUIRED = 3;

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

export const STRATEGY_MAX = 5;
/** Shown in Respond when the team skipped Advise. */
export const DEFAULT_STRATEGY: RecKey[] = ["mon", "opt", "exp", "gov", "trn"];
export const MAX_CHANGES = 2;

export const OUTCOME_KEYS = [
  "cost",
  "value",
  "adoption",
  "risk",
  "governance",
] as const;
export const METRIC_KEYS = [
  "costPerToken",
  "adoption",
  "csat",
  "resolution",
  "roi",
  "incidents",
] as const;
export const METRICS_MAX = 3;
export const SITUATION_MAX = 500;

// Mock leaderboard until the customer's scores come from the backend.
export const MOCK_PODIUM = [
  { rank: 2, team: "14", points: 87 },
  { rank: 1, team: "08", points: 89 },
  { rank: 3, team: "03", points: 85 },
];
export const MOCK_BOARD = [
  { rank: 4, team: "06", points: 82 },
  { rank: 5, team: "11", points: 79 },
  { rank: 6, team: "02", points: 78 },
  { rank: 7, team: "09", points: 75 },
  { rank: 8, team: "05", points: 73 },
];
