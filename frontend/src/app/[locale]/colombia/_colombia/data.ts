// Structure and figures for the Colombia Aspire app: the Asoexport coffee
// case. Visible texts live in content.ts (case content) and in messages under
// "Colombia" (labels); this file holds keys, numbers and levels.
//
// Sources for every figure: Asoexport, "Reporte de cifras cafeteras, octubre
// 2026" (exports) and the document Asoexport wrote for LEAD Aspire Day
// Microsoft (value chain, rural connectivity). Change a figure here and in
// the matching message only together with its source.
//
// Option keys (CLASS_KEYS, CAUSE_KEYS, REC_KEYS) are stored in the team's
// saved answers: renaming one orphans answers already saved under the old key.

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

/** A level shown as a colored pill (labels in messages under "Colombia.values"). */
export type Level = "high" | "medium" | "low" | "verylow";

/**
 * Discover > Sector dashboard cards. Values and labels are in messages
 * (discover.kpis.<key>) so each locale formats its own numbers.
 * `arrow`: the direction shown before the delta, if any.
 */
export const KPIS = [
  { key: "exports", tone: "bad", arrow: "down" },
  { key: "green", tone: "neutral", arrow: null },
  { key: "families", tone: "neutral", arrow: null },
  { key: "internet", tone: "bad", arrow: null },
] as const;

/**
 * Discover > Sector dashboard chart: monthly coffee exports, in thousands of
 * 60 kg bags, January to October. Asoexport, Reporte Octubre 2026, Gráfico 2.
 * The 2026 series sums to 9,570 and the 2025 series to 10,864 (-11.9%).
 */
export const EXPORT_TREND = {
  year: 2026,
  current: [925, 847, 796, 693, 921, 1053, 995, 1049, 1172, 1119],
  previous: [1153, 1184, 1252, 802, 912, 1085, 1174, 1167, 1078, 1057],
} as const;
export const EXPORT_TREND_MAX = 1400;
export const EXPORT_TREND_TICKS = [0, 400, 800, 1200] as const;

/** The six links of the coffee value chain, in the order coffee moves. */
export const CHAIN_KEYS = [
  "supply",
  "farm",
  "wetmill",
  "collection",
  "mill",
  "export",
] as const;
export type ChainKey = (typeof CHAIN_KEYS)[number];

/**
 * Per link: how much usable data exists today, and how much the link weighs
 * on traceability (texts in messages under "Colombia.chain").
 */
export const CHAIN: Record<ChainKey, { data: Level; impact: Level }> = {
  supply: { data: "low", impact: "medium" },
  farm: { data: "verylow", impact: "high" },
  wetmill: { data: "verylow", impact: "high" },
  collection: { data: "low", impact: "high" },
  mill: { data: "medium", impact: "high" },
  export: { data: "medium", impact: "medium" },
};

// Strategize > Diagnose and Advise: practice activities for brainstorming,
// not graded. Saved for the team under the Strategize phase (answers.ts).

/** Diagnose: how a team classifies each link of the chain. */
export const CLASS_KEYS = [
  "urgent",
  "digitize",
  "investigate",
  "later",
] as const;
export type ClassKey = (typeof CLASS_KEYS)[number];

export const CLASS_COLORS: Record<ClassKey, string> = {
  urgent: "var(--brand-red)",
  digitize: "var(--brand-purple)",
  investigate: "oklch(0.75 0.14 70)",
  later: "oklch(0.65 0.15 155)",
};

export const CAUSE_KEYS = [
  "fragmentation",
  "connectivity",
  "literacy",
  "cash",
  "interoperability",
  "geolocation",
  "postharvest",
  "logistics",
  "volatility",
  "succession",
] as const;
/** Diagnose: how many root causes a team can pick. */
export const CAUSES_MAX = 3;

export const REC_KEYS = [
  "polygons",
  "whatsapp",
  "lots",
  "compliance",
  "quality",
  "training",
] as const;
export type RecKey = (typeof REC_KEYS)[number];

/**
 * Game values, not real data. `weeks` sizes the implementation time; `fx` is
 * the effect in percent on [producer margin, market access, field adoption,
 * regulatory risk]. For the risk, a positive value means it goes down.
 */
export const RECS: Record<
  RecKey,
  { cost: string; weeks: number; fx: [number, number, number, number] }
> = {
  polygons: { cost: "$$", weeks: 8, fx: [2, 9, 3, 10] },
  whatsapp: { cost: "$", weeks: 5, fx: [3, 4, 9, 4] },
  lots: { cost: "$$", weeks: 6, fx: [5, 6, 5, 6] },
  compliance: { cost: "$$$", weeks: 10, fx: [1, 8, 2, 12] },
  quality: { cost: "$$", weeks: 8, fx: [7, 4, 2, 1] },
  training: { cost: "$", weeks: 6, fx: [2, 2, 8, 3] },
};

/** Advise: the most recommendations a strategy can hold. */
export const STRATEGY_MAX = 5;
