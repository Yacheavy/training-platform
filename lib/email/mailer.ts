import nodemailer from "nodemailer";
import { APP_NAME, CREATOR } from "@/lib/brand";

/** Gmail por SMTP con contraseña de aplicación (SMTP_USER / SMTP_PASS en Vercel). Sin esas variables no se envía nada. */
export function mailConfigured(): boolean {
  return !!(smtpUser() && smtpPass());
}

/** Limpia comillas, espacios y saltos de línea que suelen colarse al pegar la variable. */
function clean(v: string | undefined): string {
  return (v ?? "").replace(/^["']|["']$/g, "").replace(/\s+/g, "");
}
function smtpUser(): string {
  return clean(process.env.SMTP_USER);
}
function smtpPass(): string {
  return clean(process.env.SMTP_PASS);
}

/** Datos no secretos para diagnosticar un 535 en los logs (nunca el valor). */
export function smtpDiagnostics(): string {
  const u = smtpUser();
  const p = smtpPass();
  const rawLen = (process.env.SMTP_PASS ?? "").length;
  return `SMTP_USER=${u ? u : "(vacío)"} · SMTP_PASS largo=${p.length} (original ${rawLen}, esperado 16) · solo letras minúsculas=${/^[a-z]+$/.test(p)}`;
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
    auth: { user: smtpUser(), pass: smtpPass() },
  });
  await transport.sendMail({
    from: `"${APP_NAME}" <${smtpUser()}>`,
    replyTo: CREATOR.email,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}
