"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { buildChatContext } from "@/lib/chat/context-builder";
import { askClaude } from "@/lib/chat/claude-client";
import { parseClaudeResponse } from "@/lib/chat/parse-response";
import { validateBlocks } from "@/lib/chat/validate-blocks";
import { findUnverifiedCitations } from "@/lib/chat/citation-check";
import { dayStartLocal } from "@/lib/tz";
import { calculateTss } from "@/lib/training-engine/tss";
import { calculateFueling } from "@/lib/training-engine/fueling";
import { revalidatePath } from "next/cache";
import { createEvent } from "@/lib/intervals-client";
import { getIntervalsCreds } from "@/lib/intervals-creds";
import { buildStructuredWorkout } from "@/lib/training-engine/workout-description";
import { buildWorkoutName } from "@/lib/training-engine/workout-naming";
import { dateKeyLocal } from "@/lib/tz";

const DAILY_LIMIT = Number(process.env.CHAT_DAILY_LIMIT) || 30;
const MAX_MESSAGE_CHARS = 2000;

type Focus = { workoutId?: string; activityId?: string };

function focusFields(f: Focus) {
  if (f.workoutId) return { focusedEntityId: f.workoutId, focusedEntityType: "generated_workout" };
  if (f.activityId) return { focusedEntityId: f.activityId, focusedEntityType: "activity" };
  return { focusedEntityId: null, focusedEntityType: null };
}

async function saveAssistant(athleteId: string, content: string, focus: Focus = {}) {
  await prisma.chatMessage.create({ data: { athleteId, role: "assistant", content, ...focusFields(focus) } });
}

export async function sendChatMessage(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const athleteId = session.user.id;
  const messageText = String(formData.get("message") ?? "").slice(0, MAX_MESSAGE_CHARS);
  const focusedWorkoutId = formData.get("focusedWorkoutId") ? String(formData.get("focusedWorkoutId")) : undefined;
  const focusedActivityId = !focusedWorkoutId && formData.get("focusedActivityId") ? String(formData.get("focusedActivityId")) : undefined;
  const focus: Focus = { workoutId: focusedWorkoutId, activityId: focusedActivityId };

  if (!messageText.trim()) return;

  // Límite diario por alumno (el entrenador no tiene tope): protege el gasto de la API de IA
  const me = await prisma.user.findUnique({ where: { id: athleteId }, select: { role: true, ftp: true } });
  if (me?.role !== "COACH") {
    const sentToday = await prisma.chatMessage.count({ where: { athleteId, role: "user", createdAt: { gte: dayStartLocal(new Date()) } } });
    if (sentToday >= DAILY_LIMIT) {
      await saveAssistant(athleteId, `Llegaste al límite de ${DAILY_LIMIT} mensajes de hoy. Mañana se renueva; si es urgente, consultalo con tu entrenador.`);
      revalidatePath("/chat");
      return;
    }
  }

  await prisma.chatMessage.create({
    data: { athleteId, role: "user", content: messageText, ...focusFields(focus) },
  });

  const context = await buildChatContext(athleteId, focusedWorkoutId, focusedActivityId);

  const recentHistory = await prisma.chatMessage.findMany({
    where: { athleteId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const history = recentHistory.reverse().slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

  let reply: { text: string; truncated: boolean };
  try {
    reply = await askClaude(context, messageText, history);
  } catch (err) {
    console.error("askClaude falló:", err);
    await saveAssistant(athleteId, "No pude responder en este momento. Probá de nuevo en unos minutos.", focus);
    revalidatePath("/chat");
    return;
  }
  let parsed = parseClaudeResponse(reply.text);

  // El modelo a veces dice "listo, lo ajusté" sin mandar el json_blocks: no se guardaría nada.
  // Se reintenta una vez pidiéndole solo el bloque.
  const CLAIMS_CHANGE = /(?<![\p{L}])(listo|ajustad[ao]|ajust[ée]|cambi[ée]|modifiqu[ée]|actualic[ée]|apliqu[ée]|quedó|quedo)(?![\p{L}])/iu;
  // Solo se reintenta si el atleta pidió/confirmó un cambio (o venía de ofrecerle opciones)
  const EDIT_INTENT = /(?<![\p{L}])(aplic|cambi|modific|ajust|pon[eé]|pasa|hac[eé]|agreg|quit|sac[aá]|sub[ií]|baj[aá]|dale|opci[oó]n|h[ií]brid|acept|confirm|(?:sí|si|ok|va)(?![\p{L}]))/iu;
  const priorOffered = history.length > 0 && history[history.length - 1].role === "assistant" && history[history.length - 1].content.includes("```opciones");
  const userAskedChange = EDIT_INTENT.test(messageText) || priorOffered;
  if (focusedWorkoutId && userAskedChange && parsed.updatedBlocks === null && !parsed.blocksUnreadable && CLAIMS_CHANGE.test(parsed.text)) {
    try {
      const retry = await askClaude(
        context,
        "Aplicá ahora el cambio que acordamos. Respondé SOLO con una línea corta y el bloque json_blocks con el workout COMPLETO actualizado.",
        [...history, { role: "user", content: messageText }, { role: "assistant", content: reply.text }]
      );
      const again = parseClaudeResponse(retry.text);
      if (again.updatedBlocks !== null || again.blocksUnreadable) parsed = { ...parsed, updatedBlocks: again.updatedBlocks, blocksUnreadable: again.blocksUnreadable };
    } catch (err) {
      console.error("Reintento de json_blocks falló:", err);
    }
  }
  const { updatedBlocks, blocksUnreadable } = parsed;
  const claimedButNoBlocks = !!focusedWorkoutId && userAskedChange && updatedBlocks === null && !blocksUnreadable && CLAIMS_CHANGE.test(parsed.text);
  // Control automático: toda cita debe estar en la bibliografía cerrada; si no, se avisa
  const unverified = findUnverifiedCitations(parsed.text);
  const text = unverified.length
    ? `${parsed.text}\n\n⚠ Revisión automática: mencioné ${unverified.join(", ")}, que no figura en mi bibliografía verificada. Tomalo como no confirmado.`
    : parsed.text;

  // Resultado REAL de la edición: el texto del modelo puede decir "listo, lo cambié" aunque no se haya aplicado
  let notice: string | null = null;

  if (updatedBlocks !== null || blocksUnreadable) {
    if (blocksUnreadable) {
      notice = reply.truncated
        ? "La respuesta se cortó antes de terminar el cambio, así que no lo apliqué. Pedímelo de nuevo."
        : "No pude leer el cambio propuesto, así que no lo apliqué. Pedímelo de nuevo.";
    } else if (!focusedWorkoutId) {
      notice = focusedActivityId
        ? "No apliqué ningún cambio: esa actividad ya se hizo y no se puede modificar. Para cambiar una sesión que viene, abrí el chat desde «Pedir ajustes» en esa sesión."
        : "No apliqué ningún cambio: para editar una sesión abrí el chat desde «Pedir ajustes» en esa sesión.";
    } else {
      const workout = await prisma.generatedWorkout.findFirst({ where: { id: focusedWorkoutId, athleteId } });
      if (!workout) notice = "No encontré esa sesión, no apliqué el cambio.";
      else if (workout.status === "COMPLETED")
        notice = "Esta sesión ya se realizó, por eso no apliqué el cambio.";
      else if (!me?.ftp) notice = "Configurá tu FTP para poder editar sesiones; no apliqué el cambio.";
      else {
        const original = (workout.blocksJson as unknown as { durationSec: number }[]).reduce((s, b) => s + (b.durationSec ?? 0), 0);
        const check = validateBlocks(updatedBlocks, { ftp: me.ftp, originalTotalSec: original, originalTypes: (workout.blocksJson as unknown as { type: string }[]).map((b) => b.type) });
        if (!check.ok) notice = `No apliqué el cambio porque no pasó la validación (${check.reason}).`;
        else {
          // Se recalcula TODO lo derivado (TSS, kJ, carbos) en el mismo paso
          const tss = calculateTss(check.blocks, me.ftp);
          const fueling = calculateFueling(check.blocks, me.ftp);
          const wasSent = workout.status === "SENT_TO_INTERVALS";

          // Si la sesión ya estaba en el calendario de Intervals, se actualiza ahí también (upsert por
          // external_id). Primero Intervals: si falla, no se toca la sesión local y no quedan distintas.
          let resyncFailed = false;
          if (wasSent) {
            try {
              const creds = await getIntervalsCreds(athleteId);
              if (!creds) throw new Error("sin credenciales");
              const description = buildStructuredWorkout(
                check.blocks,
                me.ftp,
                { totalKj: fueling.totalKj, suggestedCarbsG: fueling.suggestedCarbsG, suggestedCarbsGPerHour: fueling.suggestedCarbsGPerHour, requiresMultipleCarbSources: fueling.requiresMultipleCarbSources },
                workout.rationale
              );
              await createEvent(creds.athleteId, creds.apiKey, {
                external_id: workout.id,
                name: buildWorkoutName(workout.workoutLibraryKey, check.blocks, me.ftp),
                startDateLocal: dateKeyLocal(new Date(workout.date)) + "T07:00:00",
                description,
                movingTimeSec: check.blocks.reduce((s, b) => s + b.durationSec, 0),
              });
            } catch (err) {
              console.error("Reenvío a Intervals falló:", err);
              resyncFailed = true;
              notice = "No pude actualizar la sesión en Intervals, así que no apliqué el cambio. Probá de nuevo en unos minutos.";
            }
          }

          if (!resyncFailed) await prisma.generatedWorkout.update({
            where: { id: workout.id },
            data: {
              blocksJson: check.blocks,
              estimatedTss: tss,
              estimatedKj: fueling.totalKj,
              suggestedCarbsG: fueling.suggestedCarbsG,
              suggestedCarbsGPerHour: fueling.suggestedCarbsGPerHour,
              requiresMultipleCarbSources: fueling.requiresMultipleCarbSources,
              status: wasSent ? "SENT_TO_INTERVALS" : "EDITED",
              ...(wasSent ? { sentToIntervalsAt: new Date() } : {}),
            },
          });
          if (!resyncFailed && wasSent) notice = "✓ Actualicé la sesión también en tu calendario de Intervals.";
        }
      }
    }
  }

  if (!notice && claimedButNoBlocks)
    notice = "No apliqué ningún cambio en la sesión (no llegó la versión modificada). Escribime «aplicalo» y lo intento de nuevo.";

  const optionsBlock = parsed.options.length ? `\n\n\`\`\`opciones\n${JSON.stringify(parsed.options)}\n\`\`\`` : "";
  const finalText = (notice ? `${notice.startsWith("✓") ? "" : "⚠ "}${notice}\n\n${text}` : reply.truncated ? `${text}\n\n(La respuesta se cortó por largo.)` : text) + optionsBlock;
  await saveAssistant(athleteId, finalText, focus);

  revalidatePath("/chat");
  revalidatePath("/dashboard");
  if (focusedWorkoutId) revalidatePath(`/workouts/${focusedWorkoutId}`);
}
