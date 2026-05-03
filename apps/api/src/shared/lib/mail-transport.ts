import nodemailer, { type Transporter } from 'nodemailer';
import { resend, isResendConfigured, RESEND_FROM_EMAIL } from './resend';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

export interface SendMailResult {
  ok: boolean;
  id?: string;
  transport: 'smtp' | 'resend' | 'none';
  reason?: string;
}

let smtpTransporter: Transporter | null = null;
function getSmtpTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  if (smtpTransporter) return smtpTransporter;
  smtpTransporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
  });
  return smtpTransporter;
}

export function getMailTransport(): 'smtp' | 'resend' | 'none' {
  // MAIL_TRANSPORT explicitly set takes precedence
  const explicit = process.env.MAIL_TRANSPORT;
  if (explicit === 'smtp') return 'smtp';
  if (explicit === 'resend') return 'resend';

  // Otherwise pick based on what's configured: prefer SMTP when SMTP_HOST is
  // set (intentional dev / staging override), else Resend, else nothing.
  if (process.env.SMTP_HOST) return 'smtp';
  if (isResendConfigured()) return 'resend';
  return 'none';
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const transport = getMailTransport();

  if (transport === 'smtp') {
    const t = getSmtpTransporter();
    if (!t) {
      return { ok: false, transport: 'smtp', reason: 'SMTP_HOST not set' };
    }
    try {
      const info = await t.sendMail({
        from: RESEND_FROM_EMAIL,
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
      return { ok: true, transport: 'smtp', id: info.messageId };
    } catch (err) {
      return {
        ok: false,
        transport: 'smtp',
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (transport === 'resend') {
    if (!resend) {
      return { ok: false, transport: 'resend', reason: 'Resend not configured' };
    }
    try {
      const result = await resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
      return { ok: true, transport: 'resend', id: result.data?.id };
    } catch (err) {
      return {
        ok: false,
        transport: 'resend',
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    ok: false,
    transport: 'none',
    reason: 'No mail transport configured (set SMTP_HOST or RESEND_API_KEY)',
  };
}
