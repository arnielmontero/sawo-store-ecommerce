import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

// Built lazily and cached — nodemailer pools connections per transport, so
// rebuilding one per send would drop the pool and reconnect every time.
let cached: Transporter | null = null;

export function isMailerConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASSWORD);
}

function getTransport(): Transporter {
  if (cached) return cached;
  if (!isMailerConfigured()) {
    throw new Error("Email isn't configured — set SMTP_HOST/PORT/USER/PASSWORD in the API's .env.");
  }

  cached = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // 465 wants implicit TLS; 587 connects plaintext then upgrades via
    // STARTTLS, which nodemailer does automatically when secure is false.
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  return cached;
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

// Verifies the SMTP credentials actually connect and authenticate, without
// sending anything — what the Configuration page's "test connection" button
// needs, since a silent misconfiguration otherwise only surfaces the first
// time a real receipt fails to reach a customer.
export async function verifyMailer(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await getTransport().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to connect to the mail server." };
  }
}

export async function sendMail(input: SendMailInput) {
  const transport = getTransport();
  return transport.sendMail({
    from: env.SMTP_FROM ?? env.SMTP_USER,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  });
}
