// Content for the New York Aspire app (design: LEAD Aspire v3).
// Visible text lives in messages under "Aspire"; this file holds structure only.

export const PHASE_KEYS = ["discover", "strategize", "build", "pitch"] as const;
export type PhaseKey = (typeof PHASE_KEYS)[number];

export function isPhaseKey(value: string): value is PhaseKey {
  return (PHASE_KEYS as readonly string[]).includes(value);
}

export type PhaseTone = "red" | "purple";

export const PHASES: Record<PhaseKey, { num: string; tone: PhaseTone; image: string }> = {
  discover: { num: "01", tone: "red", image: "/dashboard/discover.png" },
  strategize: { num: "02", tone: "purple", image: "/dashboard/strategize.png" },
  build: { num: "03", tone: "red", image: "/dashboard/build.png" },
  pitch: { num: "04", tone: "purple", image: "/dashboard/pitch.png" },
};

export type DocType = "pdf" | "word" | "image";

/**
 * Guides students open from a phase. `file` is null until the document is
 * added under public/new-york/pdfs; the viewer then shows "coming soon".
 */
export const DOCS = {
  discovery: { type: "pdf", file: "/new-york/pdfs/discovery.pdf" },
  questions: { type: "pdf", file: "/new-york/pdfs/questions.pdf" },
  mastercard: { type: "pdf", file: "/new-york/pdfs/mastercard.pdf" },
  notes: { type: "word", file: "/new-york/pdfs/notes.docx" },
  consulting: { type: "pdf", file: "/new-york/pdfs/consulting.pdf" },
  sow: { type: "word", file: "/new-york/pdfs/sow.docx" },
  mdreview: { type: "pdf", file: "/new-york/pdfs/mdreview.pdf" },
  foundry: { type: "pdf", file: "/new-york/pdfs/foundry.pdf" },
  copilot: { type: "pdf", file: "/new-york/pdfs/copilot.pdf" },
  security: { type: "pdf", file: "/new-york/pdfs/security.pdf" },
  buildcheck: { type: "pdf", file: "/new-york/pdfs/buildcheck.pdf" },
  playbook: { type: "pdf", file: "/new-york/pdfs/playbook.pdf" },
  // Opened from the whiteboard card, not listed as its own resource.
  whiteboardExample: { type: "image", file: "/new-york/whiteboard-example.png" },
} satisfies Record<string, { type: DocType; file: string | null }>;

export type DocKey = keyof typeof DOCS;

export type Resource =
  | { kind: "doc"; doc: DocKey }
  | { kind: "whiteboard" }
  | { kind: "submit" };

export const PHASE_RESOURCES: Record<PhaseKey, Resource[]> = {
  discover: [
    { kind: "doc", doc: "discovery" },
    { kind: "doc", doc: "questions" },
    { kind: "doc", doc: "mastercard" },
    { kind: "doc", doc: "notes" },
  ],
  strategize: [
    { kind: "doc", doc: "consulting" },
    { kind: "whiteboard" },
    { kind: "doc", doc: "sow" },
    { kind: "doc", doc: "mdreview" },
  ],
  build: [
    { kind: "doc", doc: "foundry" },
    { kind: "doc", doc: "copilot" },
    { kind: "doc", doc: "security" },
    { kind: "doc", doc: "buildcheck" },
  ],
  pitch: [{ kind: "doc", doc: "playbook" }, { kind: "submit" }],
};
