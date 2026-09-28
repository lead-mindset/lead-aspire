// Student guide from docs/brd/students step by step in Foundry.docx.
// Text lives in messages (NewYorkPage.parts / NewYorkPage.steps); screenshots in public/new-york.

export type Screenshot = { src: string; width: number; height: number };

export type Step = {
  id:
    | "portal"
    | "search"
    | "create"
    | "properties"
    | "name"
    | "review"
    | "goToPortal"
    | "home"
    | "playground"
    | "ownAgent";
  href?: string;
  screenshots: Screenshot[];
  /** Text students copy into Foundry, shown with a copy button. */
  prompt?: string;
};

export type Part = { id: "foundry" | "agent"; steps: Step[] };

// Kept in English in every locale: students paste it as-is into Foundry.
const AGENT_INSTRUCTIONS = `You are a Fraud Investigation Assistant.

Help analysts summarize suspicious transaction reports.

Return:
- Risk level
- Summary
- Recommended action`;

const shot = (n: number, width: number, height: number): Screenshot => ({
  src: `/new-york/foundry-${String(n).padStart(2, "0")}.png`,
  width,
  height,
});

export const PARTS: Part[] = [
  {
    id: "foundry",
    steps: [
      {
        id: "portal",
        href: "https://azure.microsoft.com/en-us/free/students?icid=portal",
        screenshots: [],
      },
      { id: "search", screenshots: [shot(1, 1916, 912)] },
      { id: "create", screenshots: [shot(2, 1913, 905)] },
      { id: "properties", screenshots: [shot(3, 1917, 903)] },
      { id: "name", screenshots: [shot(4, 1915, 906)] },
      {
        id: "review",
        screenshots: [shot(5, 1917, 907), shot(6, 1911, 857)],
      },
      { id: "goToPortal", screenshots: [shot(7, 1917, 911)] },
      { id: "home", screenshots: [shot(8, 1911, 910)] },
    ],
  },
  {
    id: "agent",
    steps: [
      { id: "playground", screenshots: [shot(13, 1916, 911)] },
      {
        id: "ownAgent",
        prompt: AGENT_INSTRUCTIONS,
        screenshots: [shot(14, 1917, 907), shot(15, 1917, 908)],
      },
    ],
  },
];
