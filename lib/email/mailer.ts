import nodemailer from "nodemailer";
import { APP_NAME } from "@/lib/brand";

/** Gmail por SMTP con contraseña de aplicación (SMTP_USER / SMTP_PASS en Vercel). Sin esas variables no se envía nada. */
export function mailConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function appUrl(): string {
  const raw = process.env.NEXTAUTH_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return raw.replace(/\/$/, "");
}

export async function sendMail(opts: { to: string; subject: string; html: string; text: string }): Promise<void> {
  if (!mailConfigured()) throw new Error("El envío de mails no está configurado (faltan SMTP_USER y SMTP_PASS).");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: `"${APP_NAME}" <${process.env.SMTP_USER}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}
