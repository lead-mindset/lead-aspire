import { Resend } from "resend";

/** Default sender. Must be on a domain verified in Resend. */
export const DEFAULT_FROM = "LEAD <no-reply@leadmindset.org>";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text fallback. Recommended for deliverability. */
  text?: string;
  from?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
};

export type SendEmailResult = { id: string };

let client: Resend | null = null;

// Created lazily so importing this module never requires the key (e.g. during
// `next build`). Server-only: never import this from Client Components.
function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  client ??= new Resend(apiKey);
  return client;
}

export async function sendEmail({
  from = DEFAULT_FROM,
  ...input
}: SendEmailInput): Promise<SendEmailResult> {
  const { data, error } = await getClient().emails.send({ from, ...input });

  if (error || !data) {
    throw new Error(`Failed to send email: ${error?.message ?? "no response"}`);
  }
  return { id: data.id };
}
