import { APP_NAME, CREATOR } from "@/lib/brand";
import { appUrl, mailConfigured, sendMail } from "./mailer";
import { layoutEmail } from "./template";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const P = 'style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#C5CED8"';
const STEP_NUM = 'style="width:26px;vertical-align:top;padding:2px 10px 12px 0"><div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:rgba(79,209,197,.15);color:#4FD1C5;font-size:13px;font-weight:700;text-align:center"';

function step(n: number, title: string, body: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td ${STEP_NUM}>${n}</div></td><td style="vertical-align:top;padding-bottom:12px"><div style="font-size:15px;font-weight:600;color:#E7ECF2;margin-bottom:3px">${title}</div><div style="font-size:14px;line-height:1.6;color:#A9B4C0">${body}</div></td></tr></table>`;
}

export type InviteMailResult = "sent" | "skipped" | "failed";

/** Mail de invitación: quién invita, cómo entrar, cómo instalar la app y cómo conectar Intervals. Nunca lanza error: la invitación ya está guardada. */
export async function sendInvitationEmail(to: string, coachName: string | null): Promise<InviteMailResult> {
  if (!mailConfigured()) return "skipped";
  const base = appUrl();
  const who = coachName?.trim() || CREATOR.name;
  const title = `${who} te invitó a ${APP_NAME}`;
  const bodyHtml = `
<p ${P}>Hola. Tu entrenador te dio acceso a <b style="color:#E7ECF2">${APP_NAME}</b>, la app donde vas a ver tu plan de entrenamiento, cómo venís de recuperación y el análisis de cada salida. Son tres pasos y lleva unos 5 minutos:</p>
${step(1, "Entrá con tu cuenta de Google", `Usá <b style="color:#E7ECF2">${esc(to)}</b>, el mail con el que te invitaron. Con otra cuenta la app no te deja pasar.`)}
${step(2, "Instalá la app en tu celular", `<b style="color:#C5CED8">iPhone:</b> abrí el link en Safari, tocá el botón Compartir y elegí «Agregar a inicio».<br><b style="color:#C5CED8">Android:</b> abrilo en Chrome, tocá los tres puntos y elegí «Instalar app» (o «Agregar a la pantalla principal»).<br>Queda con su ícono, como cualquier otra app.`)}
${step(3, "Conectá tu Intervals.icu", `La app pide tu Athlete ID y una API key (se generan en intervals.icu/settings, sección Developer Settings). La guía te muestra cómo, con paso a paso.`)}
<p ${P}>Preparé una guía corta con todo lo que necesitás: cómo funciona la app y cómo armar tu plan.</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:6px 0 4px"><tr><td style="border-radius:12px;border:1px solid #2A3441"><a href="${base}/guia" style="display:inline-block;padding:10px 18px;font-size:13.5px;font-weight:600;color:#4FD1C5;text-decoration:none">Leer la guía</a></td></tr></table>
<p style="margin:14px 0 0;font-size:12.5px;line-height:1.6;color:#8A97A6">La app usa tus datos de entrenamiento y recuperación para armar tu plan. Antes de ingresar vas a ver la política de privacidad y vas a poder aceptarla o no. Si no esperabas este mail, ignoralo: no pasa nada hasta que alguien entre con tu cuenta.</p>`;
  const text = `${title}\n\nEntrá con tu cuenta de Google (${to}): ${base}/login\n\n1. Entrá con ese mail.\n2. Instalá la app. iPhone: Safari > Compartir > Agregar a inicio. Android: Chrome > tres puntos > Instalar app.\n3. Conectá tu Intervals.icu (Athlete ID y API key, en intervals.icu/settings > Developer Settings).\n\nGuía: ${base}/guia\n\nSi no esperabas este mail, ignoralo.`;
  try {
    await sendMail({
      to,
      subject: title,
      html: layoutEmail({ title, subtitle: "Invitación", bodyHtml, ctaLabel: "Entrar a la app", ctaPath: "/login", footerNote: `${APP_NAME} es una guía deportiva: no reemplaza a un médico ni da diagnósticos.` }),
      text,
    });
    return "sent";
  } catch (e) {
    console.error("sendInvitationEmail falló", e);
    return "failed";
  }
}
