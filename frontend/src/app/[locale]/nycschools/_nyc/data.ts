// Content for the NYC Schools Copilot Executive Lab (from Copilot_Executive_Lab.html).
// Visible text lives in messages under "NycSchools"; this file holds structure and
// the text people paste into Copilot Chat, kept in English in every locale.

export const COPILOT_CHAT_URL = "https://m365.cloud.microsoft/chat";

export const STEP_KEYS = ["discover", "explore", "refine", "apply"] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export function isStepKey(value: string): value is StepKey {
  return (STEP_KEYS as readonly string[]).includes(value);
}

/** Wide banner photo shared with Dallas; `position` keeps the faces in the crop. */
export type Banner = { src: string; position: string };

export const HOME_BANNER: Banner = { src: "/dashboard/dallas-team-setup.png", position: "right 30%" };

export const STEPS: Record<StepKey, { num: string; tone: "red" | "purple"; minutes: number; banner: Banner }> = {
  discover: {
    num: "01",
    tone: "red",
    minutes: 10,
    banner: { src: "/dashboard/dallas-contoso.png", position: "right 30%" },
  },
  explore: {
    num: "02",
    tone: "purple",
    minutes: 15,
    banner: { src: "/dashboard/dallas-strategize.png", position: "right 10%" },
  },
  refine: {
    num: "03",
    tone: "red",
    minutes: 15,
    banner: { src: "/dashboard/dallas-strategize-build.png", position: "right 8%" },
  },
  apply: {
    num: "04",
    tone: "purple",
    minutes: 15,
    banner: { src: "/dashboard/dallas-pitch.png", position: "right 15%" },
  },
};

export const CASE_BRIEF = `Administrative Service Desk — Fictional Snapshot
A central office receives 120 administrative requests weekly. Average response time is 8 business days against a 5-day goal. Approximately 35% of incoming requests repeat prior questions or ask for clarification. Staff cite inconsistent intake information and unclear ownership. Common request areas are vendor onboarding, procurement request status, and policy or equal opportunity guidance. No additional headcount is available this quarter. Any changes require accessibility, privacy, fairness, and applicable procurement controls.
All data is fictional.`;

export const REQUEST_CSV = `Week,Vendor Onboarding,Procurement Status,Policy Guidance,Other,Total Requests,Avg Response Days
1,35,30,25,30,120,8.0
2,40,28,27,25,120,8.3
3,37,33,29,21,120,8.1
4,32,36,31,21,120,8.2`;

export const BRIEF_TEMPLATE = `EXECUTIVE ACTION BRIEF (FICTIONAL LAB)
Objective:
Current situation and evidence:
Priority action 1:
Priority action 2:
Priority action 3:
30-day milestones:
60-day milestones:
90-day milestones:
Owners / functions:
Measures of success:
Risks and mitigations:
Assumptions and evidence to validate:
Decision needed from leadership:`;

/** Files people can download, generated in the browser. */
export const DOWNLOADS = {
  case: { name: "fictional_case_brief.txt", type: "text/plain", text: CASE_BRIEF },
  csv: { name: "fictional_request_data.csv", type: "text/csv", text: REQUEST_CSV },
  template: { name: "executive_action_brief_template.txt", type: "text/plain", text: BRIEF_TEMPLATE },
} as const;

export type DownloadKey = keyof typeof DOWNLOADS;

/** Leadership perspectives for the recommend prompt; the label is translated, the name is pasted. */
export const ROLES = {
  operations: "Operations & Service Delivery",
  supplier: "Supplier Diversity & Business Development",
  compliance: "Compliance, Policy & Equal Opportunity",
  executive: "Executive Leadership & Transformation",
} as const;

export type RoleKey = keyof typeof ROLES;

export function recommendPrompt(role: RoleKey): string {
  return `Continue our analysis. Act as an advisor to the ${ROLES[role]} function in a large public education administrative office. Recommend three practical changes to reduce response delays and repeat inquiries over the next 90 days. For each option, explain expected benefit, implementation effort, risks, and how we could measure improvement. Assume no new headcount and preserve relevant accessibility, fairness, privacy and procurement controls. Rank options by impact and feasibility; clearly label assumptions.`;
}

export const PROMPTS = {
  analyze:
    "Act as an operations advisor for a public education administrative office. Using the case briefing I provided, identify the three biggest service issues, separate facts from possible causes, and suggest what leadership should investigate first. Return a short table with: issue, evidence, possible cause, and next question. Do not invent data.",
  critique:
    "Review your previous recommendations as a skeptical public-sector executive. Identify unsupported assumptions, operational risks, equity or accessibility concerns, procurement or compliance considerations, and hidden workload. Revise the plan to make it realistic within existing staffing. Flag questions that require confirmation by a human subject-matter expert. Use a concise risk/mitigation table.",
  followUp:
    "What would you need to know before approving this plan? List five decisions or evidence gaps and identify the appropriate office to consult. Do not assert that any policy is legally required unless it is supported by an authoritative source.",
  brief:
    "Using our conversation, draft a one-page executive brief for improving administrative service response times over the next 90 days. Include: objective; three priority actions; a simple 30/60/90-day timeline; proposed accountable functions; 2–3 measurable indicators; key risks; and what leadership must decide. Clearly label assumptions and items needing validation. Keep the style concise and suitable for senior public education administrators.",
} as const;
