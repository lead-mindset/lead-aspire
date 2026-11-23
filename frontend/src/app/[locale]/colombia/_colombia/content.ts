// Case content for the Colombia challenge, in one place: replace these values
// to change the case without touching component code. Every visible text is
// given in English and Spanish ({ en, es }); interface labels (buttons,
// hints) stay in messages/*.json under "Colombia".
//
// Case: Asoexport (Asociación Nacional de Exportadores de Café de Colombia)
// and traceability in the coffee value chain. Facts come from the document
// Asoexport wrote for LEAD Aspire Day Microsoft and from asoexport.org (see
// data.ts for the figures). The four stakeholders are fictional people built
// on that document: no real person or company is named for them.
//
// Keys (role keys, stakeholder keys) are stored or used as identifiers:
// role keys are in the team's saved answers, stakeholder keys name the
// Foundry agents (backend/app/colombia_stakeholders.py). Renaming a key
// orphans what was saved or configured under the old one.

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

  /**
   * Discover > The challenge. The president presents it live at the event;
   * this tab introduces him and the problem.
   * `image`: his photo from /public ("" shows his initials). `quote`: a line
   * he approved for the app; null hides it. Do not fill it with press quotes.
   */
  challenge: {
    presenter: {
      name: "Gustavo Andrés Gómez Montero",
      initials: "GG",
      image: "",
      title: {
        en: "Executive President, Asoexport",
        es: "Presidente ejecutivo, Asoexport",
      },
    },
    quote: null as Text | null,
    paragraphs: [
      {
        en: "Colombia exports about 92% of the coffee it produces, mostly as green coffee. Yet no interoperable system connects the information from the farm to the dry mill: for conventional coffee it is almost impossible to know which farm a lot comes from.",
        es: "Colombia exporta cerca del 92 % del café que produce, casi todo como café verde. Sin embargo, no existen sistemas interoperables que conecten la información de la finca con la trilladora: en el café convencional es casi imposible saber de qué predio viene un lote.",
      },
      {
        en: "Without that traceability the sector puts at risk its access to the European Union, which buys 25% to 27% of Colombian coffee, under the EU Deforestation Regulation (EUDR, EU 2023/1115) and the Corporate Sustainability Due Diligence Directive (CS3D, EU 2024/1760).",
        es: "Sin esa trazabilidad el sector arriesga su acceso a la Unión Europea, que compra entre el 25 % y el 27 % del café colombiano, por el Reglamento sobre Deforestación (EUDR, UE 2023/1115) y la Directiva de debida diligencia en sostenibilidad (CS3D, UE 2024/1760).",
      },
    ],
    question: {
      en: "How can AI help build traceability from small farms with weak signal and low digital adoption?",
      es: "¿Cómo puede la IA ayudar a construir trazabilidad desde fincas pequeñas, con poca señal y baja adopción digital?",
    },
    /** "What you will hear live": the points of his talk. */
    live: [
      {
        en: "Where the sector stands: a record 2025 and a 2026 with lower exports",
        es: "El momento del sector: un 2025 récord y un 2026 con menos exportaciones",
      },
      {
        en: "The regulatory pressure from Europe and the United States",
        es: "La presión regulatoria de Europa y Estados Unidos",
      },
      {
        en: "Why traceability is a problem of data and of people, not only of technology",
        es: "Por qué la trazabilidad es un problema de datos y de personas, no solo de tecnología",
      },
    ],
    /** Key takeaways beside the challenge; the keys pick the icons. */
    takeaways: [
      {
        key: "trace",
        title: { en: "Weak traceability", es: "Trazabilidad débil" },
        body: {
          en: "The farm of origin of conventional coffee cannot be traced.",
          es: "No se puede rastrear el predio de origen del café convencional.",
        },
      },
      {
        key: "market",
        title: { en: "Market at risk", es: "Mercado en riesgo" },
        body: {
          en: "The EU requires geolocation and due diligence for each lot.",
          es: "La UE exige geolocalización y debida diligencia por lote.",
        },
      },
      {
        key: "rural",
        title: { en: "Disconnected countryside", es: "Campo desconectado" },
        body: {
          en: "Rural mobile internet reaches 28%, against 76% in cities.",
          es: "El internet móvil rural llega al 28 %, frente al 76 % urbano.",
        },
      },
    ],
    mission: {
      en: "Work as a Microsoft account team. Understand the coffee value chain, find where traceability breaks, and design an AI solution that works for the coffee farmer and serves the exporter.",
      es: "Trabaja como un equipo de cuenta de Microsoft. Entiende la cadena del café, identifica dónde se rompe la trazabilidad y diseña una solución con IA que funcione para el caficultor y le sirva al exportador.",
    },
  },

  /** Discover > Organization profile. */
  company: {
    name: "Asoexport",
    /** Photo beside "About", from /public; "" shows a branded card with `badge`. */
    image: "",
    badge: { en: "Since 1933", es: "Desde 1933" },
    about: {
      en: "Asoexport is the National Association of Coffee Exporters of Colombia: a private, nonprofit trade association that represents coffee exporters before the government and the logistics chain, and works to strengthen the competitiveness and sustainability of the coffee value chain.",
      es: "Asoexport es la Asociación Nacional de Exportadores de Café de Colombia: un gremio privado sin ánimo de lucro que representa a los exportadores ante el Gobierno y la cadena logística, y trabaja por la competitividad y la sostenibilidad de la cadena de valor del café.",
    },
    facts: [
      {
        key: "type",
        label: { en: "Organization", es: "Tipo de entidad" },
        value: {
          en: "Private nonprofit trade association",
          es: "Gremio privado sin ánimo de lucro",
        },
      },
      {
        key: "founded",
        label: { en: "Founded", es: "Fundación" },
        value: {
          en: "1933, as Sociedad de Exportadores de Café",
          es: "1933, como Sociedad de Exportadores de Café",
        },
      },
      {
        key: "headquarters",
        label: { en: "Headquarters", es: "Sede" },
        value: { en: "Bogotá, Colombia", es: "Bogotá, Colombia" },
      },
      {
        key: "share",
        label: { en: "Represents", es: "Representa" },
        value: {
          en: "Over 75% of Colombia's coffee exports",
          es: "Más del 75 % de las exportaciones de café",
        },
      },
      {
        key: "alliance",
        label: { en: "Alliance", es: "Alianza" },
        value: { en: "Analdex, since 2017", es: "Analdex, desde 2017" },
      },
      {
        key: "markets",
        label: { en: "Where the coffee goes", es: "Destino del café" },
        value: {
          en: "US 39%, EU 27%+, Asia 11%, Canada 7%",
          es: "EE. UU. 39 %, UE más de 27 %, Asia 11 %, Canadá 7 %",
        },
      },
    ],
    /** Shown under "Purpose": Asoexport's published tagline. */
    mission: {
      en: "We work to strengthen the competitiveness and sustainability of the coffee value chain in Colombia.",
      es: "Trabajamos en potencializar la competitividad y la sostenibilidad de la cadena del valor del café en Colombia.",
    },
    priorities: [
      {
        en: "Advocacy before the ministries, ICA, Invima and DIAN",
        es: "Gestión gremial ante los ministerios, ICA, Invima y DIAN",
      },
      {
        en: "Faster export logistics with ports and shipping lines",
        es: "Logística de exportación más ágil con puertos y navieras",
      },
      {
        en: "Training: Asoexport Academy, logistics and hedging",
        es: "Formación: Asoexport Academy, logística y coberturas",
      },
      {
        en: "Sector data: monthly report and annual coffee bulletin",
        es: "Información del sector: reporte mensual y boletín anual",
      },
    ],
    journey: [
      {
        date: { en: "1933", es: "1933" },
        text: {
          en: "Sociedad de Exportadores de Café is founded",
          es: "Nace la Sociedad de Exportadores de Café",
        },
      },
      {
        date: { en: "2017", es: "2017" },
        text: {
          en: "Strategic alliance with Analdex",
          es: "Alianza estratégica con Analdex",
        },
      },
      {
        date: { en: "2023", es: "2023" },
        text: {
          en: "Study of the coffee value chain with Swisscontact",
          es: "Caracterización de la cadena del café con Swisscontact",
        },
      },
      {
        date: { en: "2025", es: "2025" },
        text: {
          en: "Record year: 13.14M bags worth USD 6.48B",
          es: "Año récord: 13,14 M de sacos por USD 6.480 M",
        },
      },
      {
        date: { en: "2026", es: "2026" },
        text: {
          en: "90th Coffee Summit in Cartagena",
          es: "90 Cumbre Cafetera en Cartagena",
        },
      },
    ],
  },

  /**
   * Discover > Stakeholders: fictional people along the coffee chain, each
   * with a Foundry agent named by FOUNDRY_COLOMBIA_<KEY>_AGENT_NAME (prompts
   * in backend/agents/colombia). `image`: a photo from /public ("" shows the
   * initials). `profile`: the text behind "View full profile".
   */
  stakeholders: [
    {
      key: "farmer",
      name: "Rosa Elvira Cuéllar",
      initials: "RC",
      color: GREEN,
      image: "",
      title: { en: "Coffee farmer", es: "Caficultora" },
      region: { en: "Huila, 1.4 ha farm", es: "Huila, finca de 1,4 ha" },
      quote: {
        en: "I know where my coffee comes from. The problem is proving it.",
        es: "Yo sé de dónde sale mi café. El problema es demostrarlo.",
      },
      priorities: [
        {
          en: "A fair price for her coffee",
          es: "Un precio justo por su café",
        },
        {
          en: "Simple tools that work without signal",
          es: "Herramientas simples que funcionen sin señal",
        },
        {
          en: "Not losing time during harvest",
          es: "No perder tiempo en plena cosecha",
        },
      ],
      profile: {
        en: "She grows coffee on a hillside farm of 1.4 hectares and picks it by hand in the main harvest (September to December) and in the mitaca (March to June). She dries it in the sun and sells dry parchment coffee to the cooperative. She has a mid-range phone, uses WhatsApp, and the 2G signal comes and goes.",
        es: "Cultiva café en una finca de ladera de 1,4 hectáreas y recoge a mano en la cosecha principal (septiembre a diciembre) y en la mitaca (marzo a junio). Seca el café al sol y vende pergamino seco a la cooperativa. Tiene un celular de gama media, usa WhatsApp y la señal 2G va y viene.",
      },
    },
    {
      key: "coop",
      name: "Hernán Muñoz",
      initials: "HM",
      color: BLUE,
      image: "",
      title: {
        en: "Head of a cooperative collection center",
        es: "Jefe de acopio de una cooperativa",
      },
      region: { en: "Cauca", es: "Cauca" },
      quote: {
        en: "I receive coffee from hundreds of farms, and almost all of it is paid in cash.",
        es: "Recibo café de cientos de fincas y casi todo se paga en efectivo.",
      },
      priorities: [
        { en: "Record lots without paper", es: "Registrar lotes sin papel" },
        {
          en: "Keep working when the internet fails",
          es: "Seguir operando cuando falla el internet",
        },
        { en: "Protect grain quality", es: "Cuidar la calidad del grano" },
      ],
      profile: {
        en: "He receives parchment coffee from hundreds of farms smaller than one hectare. He weighs it, takes samples, checks moisture and pays, mostly in cash. Records live on paper and in a spreadsheet. The warehouse has no humidity control, so lots can spoil while they wait.",
        es: "Recibe café pergamino de cientos de fincas de menos de una hectárea. Pesa, toma muestras, revisa la humedad y paga, casi siempre en efectivo. Los registros están en papel y en una hoja de cálculo. La bodega no tiene control de humedad y los lotes se pueden dañar mientras esperan.",
      },
    },
    {
      key: "exporter",
      name: "Laura Restrepo",
      initials: "LR",
      color: PURPLE,
      image: "",
      title: {
        en: "Compliance manager at a coffee exporter",
        es: "Gerente de cumplimiento de una exportadora",
      },
      region: {
        en: "Bogotá, ships through Buenaventura",
        es: "Bogotá, despacha por Buenaventura",
      },
      quote: {
        en: "If I don't have the polygon of every farm, I can't get into Europe.",
        es: "Si no tengo el polígono de cada finca, no entro a Europa.",
      },
      priorities: [
        { en: "Comply with the EUDR", es: "Cumplir el EUDR" },
        {
          en: "Connect farm data with DIAN and VUCE",
          es: "Conectar los datos de finca con DIAN y VUCE",
        },
        {
          en: "Keep the cost per lot under control",
          es: "Controlar el costo por lote",
        },
      ],
      profile: {
        en: "She is responsible for the due diligence of every lot shipped to Europe. She needs the geolocation of each farm and proof of no deforestation. She coordinates with dry mills, road transport to the port of Buenaventura, and filings with VUCE and DIAN.",
        es: "Responde por la debida diligencia de cada lote que va a Europa. Necesita la geolocalización de cada finca y pruebas de no deforestación. Coordina con las trilladoras, el transporte por carretera hasta Buenaventura y los trámites en VUCE y DIAN.",
      },
    },
    {
      key: "buyer",
      name: "Anke Vogel",
      initials: "AV",
      color: RED,
      image: "",
      title: {
        en: "Green coffee buyer at a European roaster",
        es: "Compradora de café verde de una tostadora europea",
      },
      region: { en: "Hamburg, Germany", es: "Hamburgo, Alemania" },
      quote: {
        en: "I need proof of no deforestation before I sign the contract.",
        es: "Necesito pruebas de no deforestación antes de firmar el contrato.",
      },
      priorities: [
        { en: "Due diligence for every lot", es: "Debida diligencia por lote" },
        {
          en: "Certifications she can verify",
          es: "Certificaciones que pueda verificar",
        },
        { en: "On-time deliveries", es: "Entregas a tiempo" },
      ],
      profile: {
        en: "She buys washed Colombian arabica for blends and single-origin coffees. Under the EUDR she cannot place coffee on the European market without due diligence, and her company must also answer to the CS3D directive. Colombia competes for her contracts with Brazil and Vietnam.",
        es: "Compra arábigo lavado colombiano para mezclas y cafés de origen. Por el EUDR no puede poner café en el mercado europeo sin debida diligencia, y su empresa también responde a la directiva CS3D. Colombia compite por sus contratos con Brasil y Vietnam.",
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
  challenge: {
    presenter: { name: string; initials: string; image: string; title: Text };
    quote: Text | null;
    paragraphs: readonly Text[];
    question: Text;
    live: readonly Text[];
    takeaways: readonly { key: string; title: Text; body: Text }[];
    mission: Text;
  };
  company: {
    name: string;
    image: string;
    badge: Text;
    about: Text;
    facts: readonly { key: string; label: Text; value: Text }[];
    mission: Text;
    priorities: readonly Text[];
    journey: readonly { date: Text; text: Text }[];
  };
  stakeholders: readonly {
    key: string;
    name: string;
    initials: string;
    color: string;
    image: string;
    title: Text;
    region: Text;
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
