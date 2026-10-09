// Case content for the Dallas challenge, in one place: replace these values
// to change the case without touching component code. Every visible text is
// given in English and Spanish ({ en, es }); interface labels (buttons,
// hints) stay in messages/*.json under "Dallas".
//
// Keys (role keys, option keys) are stored in the team's saved answers, so
// renaming a key orphans answers already saved under the old one.
//
// Stage A holds the phases and roles; the Brief to Deliver content moves
// here in the next stages.

import { useLocale } from "next-intl";

/** A visible text in each site language. */
export type Text = { en: string; es: string };

/** The text for the current locale (Spanish is the site default). */
export function useText(): (text: Text) => string {
  const locale = useLocale();
  return (text) => (locale === "en" ? text.en : text.es);
}

const PURPLE = "var(--brand-purple)";
const ROSE = "var(--brand-rose)";
const RED = "var(--brand-red)";
const ORANGE = "var(--brand-orange)";

export const CONTENT = {
  /** Minutes on each phase's countdown (0 = no timer). The order is the challenge order. */
  phases: [
    { key: "team", minutes: 0 },
    { key: "brief", minutes: 25 },
    { key: "discover", minutes: 35 },
    { key: "diagnose", minutes: 35 },
    { key: "advise", minutes: 40 },
    { key: "respond", minutes: 25 },
    { key: "deliver", minutes: 40 },
  ],

  /** Team phase: the six roles a member can take. */
  roles: [
    {
      key: "ae",
      abbr: "AE",
      color: RED,
      title: { en: "Account Executive", es: "Account Executive" },
      desc: {
        en: "Customer relationship, business goals and value.",
        es: "Relación con el cliente, objetivos de negocio y valor.",
      },
    },
    {
      key: "ai",
      abbr: "AI",
      color: PURPLE,
      title: { en: "AI Specialist", es: "AI Specialist" },
      desc: {
        en: "Understands the customer's AI capabilities and strategy.",
        es: "Entiende las capacidades y la estrategia de IA del cliente.",
      },
    },
    {
      key: "csa",
      abbr: "CSA",
      color: ROSE,
      title: { en: "Cloud Solution Architect", es: "Cloud Solution Architect" },
      desc: {
        en: "Technical feasibility, architecture and optimization.",
        es: "Viabilidad técnica, arquitectura y optimización.",
      },
    },
    {
      key: "csm",
      abbr: "CSM",
      color: "oklch(0.6 0.15 155)",
      title: { en: "Customer Success Manager", es: "Customer Success Manager" },
      desc: {
        en: "Adoption, change management and measurable outcomes.",
        es: "Adopción, gestión del cambio y resultados medibles.",
      },
    },
    {
      key: "ba",
      abbr: "BA",
      color: ORANGE,
      title: {
        en: "Business / Data Analyst",
        es: "Analista de negocio / datos",
      },
      desc: {
        en: "Analyzes usage, cost and business performance.",
        es: "Analiza el uso, el costo y el desempeño del negocio.",
      },
    },
    {
      key: "sg",
      abbr: "SG",
      color: "oklch(0.6 0.15 250)",
      title: { en: "Security & Governance", es: "Seguridad y gobernanza" },
      desc: {
        en: "Risk, compliance and responsible AI.",
        es: "Riesgo, cumplimiento e IA responsable.",
      },
    },
  ],
} as const satisfies {
  phases: readonly { key: string; minutes: number }[];
  roles: readonly {
    key: string;
    abbr: string;
    color: string;
    title: Text;
    desc: Text;
  }[];
};

export type RoleKey = (typeof CONTENT.roles)[number]["key"];

/** Countdown length of a phase, in minutes (0 = no timer). */
export function phaseMinutes(phase: string): number {
  return CONTENT.phases.find((p) => p.key === phase)?.minutes ?? 0;
}
