import { prisma } from "@/lib/prisma";
import { RIDE_TYPES } from "@/lib/nutrition-data";
import { buildChatContext } from "@/lib/chat/context-builder";
import { askClaude, ANALYSIS_STYLE, ANALYSIS_MODEL } from "@/lib/chat/claude-client";
import { mailConfigured, sendMail } from "./mailer";
import { analysisBodyHtml, layoutEmail } from "./template";
import { buildActivitySummary } from "./activity-summary";

const REQUEST = `${ANALYSIS_STYLE}
Este texto se envía por email: sin markdown salvo los títulos «### » de las secciones, las viñetas «- » y **negrita** para 2 o 3 datos clave. Si hay vueltas (laps), basate en ellas para describir los intervalos realmente hechos. Si la nutrición no tiene dato, decilo en una frase y no la evalúes.`;

export type AnalysisMailResult = "sent" | "skipped" | "failed";

/**
 * Envía por mail el análisis de una salida de bici, una sola vez, cuando ya se completó o se omitió la nutrición.
 * Se "reclama" la salida antes de generar el texto para que dos disparos seguidos no manden dos mails; si falla, se libera para reintentar.
 */
export async function sendActivityAnalysis(activityId: string): Promise<AnalysisMailResult> {
  if (!mailConfigured()) return "skipped";
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, athleteId: true, type: true, name: true, date: true, durationSec: true, tss: true, nutritionLoggedAt: true, analysisEmailSentAt: true, athlete: { select: { email: true, name: true, emailAnalysis: true, emailKind: true } } },
  });
  if (!a || !a.athlete.emailAnalysis || a.analysisEmailSentAt || !a.nutritionLoggedAt) return "skipped";
  if (!RIDE_TYPES.includes(a.type) || a.durationSec < 3600) return "skipped";

  const claim = await prisma.activity.updateMany({ where: { id: a.id, analysisEmailSentAt: null }, data: { analysisEmailSentAt: new Date() } });
  if (claim.count === 0) return "skipped";

  try {
    if (a.athlete.emailKind === "SUMMARY") {
      // Resumen sin IA: solo datos de la actividad y cuentas hechas en código
      const sum = await buildActivitySummary(a.id);
      if (!sum) throw new Error("No se pudo armar el resumen");
      await sendMail({
        to: a.athlete.email,
        subject: sum.title,
        html: layoutEmail({ title: sum.title, subtitle: sum.subtitle, bodyHtml: sum.bodyHtml, ctaLabel: "Ver la sesión en la app", ctaPath: `/activities/${a.id}`, ai: false }),
        text: `${sum.title}\n\n${sum.text}\n\nResumen automático sin IA.`,
      });
      return "sent";
    }
    const context = await buildChatContext(a.athleteId, undefined, a.id);
    const { text } = await askClaude(context, REQUEST, [], 3000, ANALYSIS_MODEL);
    const clean = text.replace(/```json_blocks[\s\S]*?```/g, "").trim();
    if (!clean) throw new Error("El análisis salió vacío");
    const when = a.date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    const day = a.date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", timeZone: "UTC" });
    const title = `Análisis de tu salida del ${day}: ${a.name ?? "salida de bici"}`;
    await sendMail({
      to: a.athlete.email,
      subject: title,
      html: layoutEmail({
        title,
        subtitle: `${when} · ${Math.round(a.durationSec / 60)} min${a.tss != null ? ` · TSS ${Math.round(a.tss)}` : ""}`,
        bodyHtml: analysisBodyHtml(clean),
        ctaLabel: "Ver la sesión en la app",
        ctaPath: `/activities/${a.id}`,
      }),
      text: `${title}\n\n${clean.replace(/^#{1,4}\s+/gm, "")}\n\nEste análisis lo genera una IA y no reemplaza a un médico.`,
    });
    return "sent";
  } catch (e) {
    console.error("sendActivityAnalysis falló", e);
    await prisma.activity.update({ where: { id: a.id }, data: { analysisEmailSentAt: null } }).catch(() => {});
    return "failed";
  }
}
