"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { mailConfigured, sendMail, smtpDiagnostics } from "@/lib/email/mailer";
import { analysisBodyHtml, bodyToHtml, layoutEmail } from "@/lib/email/template";
import { splitOptions } from "@/lib/chat/parse-response";

async function me() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function setEmailAnalysis(formData: FormData) {
  const id = await me();
  const emailKind = formData.get("kind") === "SUMMARY" ? "SUMMARY" : "AI";
  await prisma.user.update({ where: { id }, data: { emailAnalysis: formData.get("enabled") === "on", emailKind } });
  revalidatePath("/settings");
}

/** Manda por mail, a la casilla del propio usuario, un análisis que le dio el asistente en el chat. */
export async function emailAnalysisToMe(formData: FormData): Promise<{ error: string } | void> {
  const id = await me();
  if (!mailConfigured()) return { error: "El envío de mails todavía no está configurado." };
  const msg = await prisma.chatMessage.findFirst({ where: { id: String(formData.get("messageId") ?? ""), athleteId: id, role: "assistant" } });
  if (!msg) return { error: "No encontré ese mensaje." };
  const u = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (!u) return { error: "Usuario no encontrado" };
  const body = splitOptions(msg.content).text.replace(/```json_blocks[\s\S]*?```/g, "").trim();
  if (!body) return { error: "El mensaje está vacío." };
  const act = msg.focusedEntityType === "activity" && msg.focusedEntityId
    ? await prisma.activity.findFirst({ where: { id: msg.focusedEntityId, athleteId: id }, select: { id: true, name: true, date: true, durationSec: true, tss: true } })
    : null;
  const title = act ? `Análisis de tu salida: ${act.name ?? "salida de bici"}` : "Respuesta del asistente de Overkill Cycling";
  const subtitle = act
    ? `${act.date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} · ${Math.round(act.durationSec / 60)} min${act.tss != null ? ` · TSS ${Math.round(act.tss)}` : ""}`
    : undefined;
  try {
    await sendMail({
      to: u.email,
      subject: title,
      html: layoutEmail({ title, subtitle, bodyHtml: analysisBodyHtml(body), ctaLabel: act ? "Ver la sesión en la app" : "Abrir el chat", ctaPath: act ? `/activities/${act.id}` : "/chat" }),
      text: `${title}\n\n${body.replace(/^#{1,4}\s+/gm, "")}\n\nEste texto lo genera una IA y no reemplaza a un médico.`,
    });
  } catch (e) {
    console.error("emailAnalysisToMe falló", e);
    return { error: `No se pudo enviar el mail: ${(e as Error).message ?? "error desconocido"}` };
  }
}

/** Manda un mail de prueba a la propia casilla para verificar la configuración. */
export async function sendTestEmail(): Promise<{ error: string } | void> {
  const id = await me();
  if (!mailConfigured()) return { error: "Falta configurar SMTP_USER y SMTP_PASS en Vercel (y redesplegar)." };
  const u = await prisma.user.findUnique({ where: { id }, select: { email: true, name: true } });
  if (!u) return { error: "Usuario no encontrado" };
  try {
    await sendMail({
      to: u.email,
      subject: "Prueba de mail de Overkill Cycling",
      html: layoutEmail({
        title: "Los mails funcionan",
        subtitle: "Mail de prueba",
        bodyHtml: bodyToHtml(`Hola${u.name ? ` ${u.name.split(" ")[0]}` : ""}. Si estás leyendo esto, la app ya puede enviarte el análisis de tus salidas.`),
        ctaLabel: "Abrir la app",
        ctaPath: "/dashboard",
      }),
      text: "Los mails funcionan. Si estás leyendo esto, la app ya puede enviarte el análisis de tus salidas.",
    });
  } catch (e) {
    const err = e as { code?: string; responseCode?: number; message?: string };
    console.error("sendTestEmail falló", e, smtpDiagnostics());
    if (err.code === "EAUTH" || err.responseCode === 535) {
      return { error: "Gmail rechazó el usuario o la contraseña de aplicación (error 535). Revisá que la contraseña sea de la cuenta overkillcycling@gmail.com, sin espacios, y que hayas redesplegado." };
    }
    return { error: `No se pudo enviar: ${err.message ?? "error desconocido"}` };
  }
}
