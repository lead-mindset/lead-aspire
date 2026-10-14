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
const GREEN = "oklch(0.6 0.15 155)";
const BLUE = "oklch(0.6 0.15 250)";

export const CONTENT = {
  /** Minutes on each phase's countdown (0 = no timer). The order is the challenge order. */
  phases: [
    { key: "team", minutes: 0 },
    { key: "discover", minutes: 60 },
    { key: "strategize", minutes: 35 },
    { key: "design", minutes: 65 },
    { key: "pitch", minutes: 40 },
  ],

  /** Team phase: the five roles a member can take, in display order. */
  roles: [
    {
      key: "ae",
      abbr: "AE",
      color: RED,
      title: { en: "Account Executive", es: "Account Executive" },
      desc: {
        en: "Customer relationships, understands business goals and drives value and adoption.",
        es: "Relación con el cliente: entiende los objetivos de negocio e impulsa el valor y la adopción.",
      },
    },
    {
      key: "ai",
      abbr: "AI",
      color: PURPLE,
      title: { en: "AI Specialist", es: "AI Specialist" },
      desc: {
        en: "Understands the customer's AI needs, explores Copilot and Azure AI capabilities, and helps design the solution strategy.",
        es: "Entiende las necesidades de IA del cliente, explora las capacidades de Copilot y Azure AI y ayuda a diseñar la estrategia de la solución.",
      },
    },
    {
      key: "se",
      abbr: "SE",
      color: BLUE,
      title: { en: "Solutions Engineer", es: "Solutions Engineer" },
      desc: {
        en: "Designs secure AI solutions, validates technical feasibility, and ensures responsible AI implementation.",
        es: "Diseña soluciones de IA seguras, valida la viabilidad técnica y asegura una implementación responsable de la IA.",
      },
    },
    {
      // Key kept from "Customer Success Manager" so saved assignments stay.
      key: "csm",
      abbr: "CSAM",
      color: GREEN,
      title: {
        en: "Customer Success Account Manager",
        es: "Customer Success Account Manager",
      },
      desc: {
        en: "Focuses on adoption, change management, and measurable business outcomes.",
        es: "Se enfoca en la adopción, la gestión del cambio y resultados de negocio medibles.",
      },
    },
    {
      key: "csa",
      abbr: "CSA",
      color: ROSE,
      title: {
        en: "Cloud Solutions Architect",
        es: "Cloud Solutions Architect",
      },
      desc: {
        en: "Defines the overall architecture, integrates Microsoft cloud and AI services, and optimizes for scalability, security and cost.",
        es: "Define la arquitectura general, integra los servicios de nube e IA de Microsoft y optimiza la escalabilidad, la seguridad y el costo.",
      },
    },
  ],
  /** Discover > Company Profile. */
  company: {
    /** Photo beside "About Contoso", from /public (e.g. "/dallas/contoso-lobby.jpg"); "" shows an empty slot. */
    image: "/dashboard/contoso-front-desk.png",
    about: {
      en: "Contoso is a global professional services company helping organizations transform through technology, consulting, and operations.",
      es: "Contoso es una empresa global de servicios profesionales que ayuda a las organizaciones a transformarse con tecnología, consultoría y operaciones.",
    },
    facts: [
      {
        key: "industry",
        label: { en: "Industry", es: "Industria" },
        value: { en: "Professional services", es: "Servicios profesionales" },
      },
      {
        key: "headquarters",
        label: { en: "Headquarters", es: "Sede" },
        value: { en: "Seattle, WA", es: "Seattle, WA" },
      },
      {
        key: "employees",
        label: { en: "Employees", es: "Empleados" },
        value: { en: "12,000", es: "12,000" },
      },
      {
        key: "revenue",
        label: { en: "Annual revenue", es: "Ingresos anuales" },
        value: { en: "$4.8B", es: "US$4.8 mil millones" },
      },
      {
        key: "markets",
        label: { en: "Primary markets", es: "Mercados principales" },
        value: {
          en: "North America, Europe, APAC",
          es: "Norteamérica, Europa, APAC",
        },
      },
      {
        key: "model",
        label: { en: "Business model", es: "Modelo de negocio" },
        value: {
          en: "Consulting and managed services",
          es: "Consultoría y servicios administrados",
        },
      },
    ],
    mission: {
      en: "To empower people and organizations to achieve more through technology.",
      es: "Empoderar a las personas y organizaciones para lograr más con la tecnología.",
    },
    priorities: [
      {
        en: "Drive productivity through AI",
        es: "Impulsar la productividad con IA",
      },
      {
        en: "Deliver exceptional client experiences",
        es: "Ofrecer experiencias excepcionales a sus clientes",
      },
      {
        en: "Maintain responsible and secure innovation",
        es: "Mantener una innovación responsable y segura",
      },
      {
        en: "Grow in key global markets",
        es: "Crecer en mercados globales clave",
      },
    ],
    journey: [
      {
        date: { en: "Jan 2024", es: "Ene 2024" },
        text: { en: "Initial pilots", es: "Pilotos iniciales" },
      },
      {
        date: { en: "Apr 2024", es: "Abr 2024" },
        text: { en: "Expanded to key teams", es: "Expansión a equipos clave" },
      },
      {
        date: { en: "Jul 2024", es: "Jul 2024" },
        text: {
          en: "Broader rollout across business units",
          es: "Despliegue en más unidades de negocio",
        },
      },
      {
        date: { en: "Oct 2024", es: "Oct 2024" },
        text: { en: "Rapid increase in usage", es: "Rápido aumento del uso" },
      },
      {
        date: { en: "Today", es: "Hoy" },
        text: { en: "Evaluating next steps", es: "Evaluando próximos pasos" },
      },
    ],
  },
  /**
   * Discover > Stakeholders. `image`: a photo from /public ("" shows an
   * empty slot). `profile`: the text behind "View full profile"; the
   * button shows only when it is set.
   */
  stakeholders: [
    {
      key: "cio",
      image: "/dashboard/contoso-cio.png",
      title: {
        en: "Chief Information Officer",
        es: "Director de Tecnología (CIO)",
      },
      quote: {
        en: "We need to scale AI responsibly while maintaining control and visibility.",
        es: "Necesitamos escalar la IA de forma responsable sin perder el control ni la visibilidad.",
      },
      priorities: [
        { en: "Drive business value", es: "Generar valor de negocio" },
        { en: "Maintain oversight", es: "Mantener la supervisión" },
        {
          en: "Enable responsible adoption",
          es: "Impulsar una adopción responsable",
        },
      ],
      profile: null,
    },
    {
      key: "cfo",
      image: "/dashboard/contoso-cfo.png",
      title: { en: "Chief Financial Officer", es: "Director Financiero (CFO)" },
      quote: {
        en: "I need to understand the costs and ensure we're getting a solid return on our investment.",
        es: "Necesito entender los costos y asegurarme de que obtenemos un buen retorno de la inversión.",
      },
      priorities: [
        { en: "Control costs", es: "Controlar los costos" },
        {
          en: "Prove business value / ROI",
          es: "Demostrar el valor de negocio / ROI",
        },
        { en: "Predictable budgeting", es: "Un presupuesto predecible" },
      ],
      profile: null,
    },
    {
      key: "cso",
      image: "/dashboard/contoso-cso.png",
      title: {
        en: "Chief Security Officer",
        es: "Director de Seguridad (CSO)",
      },
      quote: {
        en: "We must reduce risk and ensure our AI usage is secure, compliant, and governed.",
        es: "Debemos reducir el riesgo y asegurar que el uso de la IA sea seguro, cumpla las normas y esté gobernado.",
      },
      priorities: [
        {
          en: "Data security and privacy",
          es: "Seguridad y privacidad de datos",
        },
        { en: "Governance and compliance", es: "Gobernanza y cumplimiento" },
        { en: "Risk mitigation", es: "Mitigación de riesgos" },
      ],
      profile: null,
    },
    {
      key: "support",
      image: "/dashboard/contoso-vp.png",
      title: { en: "VP, Customer Support", es: "VP de Atención al Cliente" },
      quote: {
        en: "AI has helped us improve customer satisfaction, and we want to keep that momentum.",
        es: "La IA nos ha ayudado a mejorar la satisfacción de los clientes y queremos mantener ese impulso.",
      },
      priorities: [
        {
          en: "Improve customer experience",
          es: "Mejorar la experiencia del cliente",
        },
        {
          en: "Maintain and scale what works",
          es: "Mantener y escalar lo que funciona",
        },
        { en: "Minimize disruption", es: "Minimizar las interrupciones" },
      ],
      profile: null,
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
  company: {
    image: string;
    about: Text;
    facts: readonly { key: string; label: Text; value: Text }[];
    mission: Text;
    priorities: readonly Text[];
    journey: readonly { date: Text; text: Text }[];
  };
  stakeholders: readonly {
    key: string;
    image: string;
    title: Text;
    quote: Text;
    priorities: readonly Text[];
    profile: Text | null;
  }[];
};

export type RoleKey = (typeof CONTENT.roles)[number]["key"];

/** Roles with a member, ignoring keys saved for roles that were removed. */
export function assignedRoles(members: Record<string, string>): number {
  return CONTENT.roles.filter((role) => members[role.key]).length;
}

/** Countdown length of a phase, in minutes (0 = no timer). */
export function phaseMinutes(phase: string): number {
  return CONTENT.phases.find((p) => p.key === phase)?.minutes ?? 0;
}
