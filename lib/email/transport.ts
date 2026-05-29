import nodemailer from 'nodemailer';
import { getEmailConfig } from './config';

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const cfg = getEmailConfig();
  if (!cfg.enabled) {
    console.log('[email] disabled, skip:', input.to, input.subject);
    return;
  }
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    ...(cfg.user && cfg.pass ? { auth: { user: cfg.user, pass: cfg.pass } } : {}),
    tls: { rejectUnauthorized: false },
  });
  await transport.sendMail({
    from: `"${cfg.fromName}" <${cfg.from}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
