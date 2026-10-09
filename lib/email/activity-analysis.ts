import { prisma } from "@/lib/prisma";
import { RIDE_TYPES } from "@/lib/nutrition-data";
import { buildChatContext } from "@/lib/chat/context-builder";
import { askClaude } from "@/lib/chat/claude-client";
import { mailConfigured, sendMail } from "./mailer";
import { bodyToHtml, layoutEmail } from "./template";

const REQUEST = `Escribí el análisis de la salida en foco para enviarlo por email al atleta, en español rioplatense (vos).
Tono: cálido y cercano, como un entrenador que le escribe a su alumno; empezá con algo bueno y concreto de la salida. Seguí las pautas de FORMATO Y VOZ del análisis de una sesión hecha.
Formato: texto plano, de 3 a 5 párrafos cortos separados por una línea en blanco, máximo 250 palabras, sin títulos ni listas, sin emojis, sin markdown salvo **negrita** para 2 o 3 datos clave.
Contenido: (1) cómo salió la sesión frente a lo planificado (TSS, intensidad y desacople si hay dato); si hay vueltas (laps), basate en ellas para contar y describir los intervalos realmente hechos, nunca en el resumen automático; (2) la nutrición registrada (si no hay dato, decilo en una frase y no la evalúes); (3) qué implica para los próximos días, en línea con la disponibilidad de hoy.
Respetá todas las reglas: citá solo fuentes de la bibliografía y distinguí evidencia de criterio de práctica, no inventes datos, no diagnostiques. No incluyas bloques json_blocks ni propongas cambios de workout. Si usaste evidencia, cerrá con una línea "Fuentes: ...".`;

export type AnalysisMailResult = "sent" | "skipped" | "failed";

/**
 * Envía por mail el análisis de una salida de bici, una sola vez, cuando ya se completó o se omitió la nutrición.
 * Se "reclama" la salida antes de generar el texto para que dos disparos seguidos no manden dos mails; si falla, se libera para reintentar.
 */
export async function sendActivityAnalysis(activityId: string): Promise<AnalysisMailResult> {
  if (!mailConfigured()) return "skipped";
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, athleteId: true, type: true, name: true, date: true, durationSec: true, tss: true, nutritionLoggedAt: true, analysisEmailSentAt: true, athlete: { select: { email: true, name: true, emailAnalysis: true } } },
  });
  if (!a || !a.athlete.emailAnalysis || a.analysisEmailSentAt || !a.nutritionLoggedAt) return "skipped";
  if (!RIDE_TYPES.includes(a.type) || a.durationSec < 3600) return "skipped";

  const claim = await prisma.activity.updateMany({ where: { id: a.id, analysisEmailSentAt: null }, data: { analysisEmailSentAt: new Date() } });
  if (claim.count === 0) return "skipped";

  try {
    const context = await buildChatContext(a.athleteId, undefined, a.id);
    const { text } = await askClaude(context, REQUEST, [], 1200);
    const clean = text.replace(/```json_blocks[\s\S]*?```/g, "").trim();
    if (!clean) throw new Error("El análisis salió vacío");
    const when = a.date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    const title = `Análisis de tu salida: ${a.name ?? "salida de bici"}`;
    await sendMail({
      to: a.athlete.email,
      subject: title,
      html: layoutEmail({
        title,
        subtitle: `${when} · ${Math.round(a.durationSec / 60)} min${a.tss != null ? ` · TSS ${Math.round(a.tss)}` : ""}`,
        bodyHtml: bodyToHtml(clean),
        ctaLabel: "Ver la sesión en la app",
        ctaPath: `/activities/${a.id}`,
      }),
      text: `${title}\n\n${clean}\n\nEste análisis lo genera una IA y no reemplaza a un médico.`,
    });
    return "sent";
  } catch (e) {
    console.error("sendActivityAnalysis falló", e);
    await prisma.activity.update({ where: { id: a.id }, data: { analysisEmailSentAt: null } }).catch(() => {});
    return "failed";
  }
}
