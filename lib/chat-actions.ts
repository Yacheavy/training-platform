"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { buildChatContext } from "@/lib/chat/context-builder";
import { askClaude } from "@/lib/chat/claude-client";
import { parseClaudeResponse } from "@/lib/chat/parse-response";
import { validateBlocks } from "@/lib/chat/validate-blocks";
import { dayStartLocal } from "@/lib/tz";
import { calculateTss } from "@/lib/training-engine/tss";
import { calculateFueling } from "@/lib/training-engine/fueling";
import { revalidatePath } from "next/cache";

const DAILY_LIMIT = Number(process.env.CHAT_DAILY_LIMIT) || 30;
const MAX_MESSAGE_CHARS = 2000;

async function saveAssistant(athleteId: string, content: string, focusedWorkoutId?: string) {
  await prisma.chatMessage.create({
    data: { athleteId, role: "assistant", content, focusedEntityId: focusedWorkoutId ?? null, focusedEntityType: focusedWorkoutId ? "generated_workout" : null },
  });
}

export async function sendChatMessage(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const athleteId = session.user.id;
  const messageText = String(formData.get("message") ?? "").slice(0, MAX_MESSAGE_CHARS);
  const focusedWorkoutId = formData.get("focusedWorkoutId") ? String(formData.get("focusedWorkoutId")) : undefined;

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
    data: { athleteId, role: "user", content: messageText, focusedEntityId: focusedWorkoutId ?? null, focusedEntityType: focusedWorkoutId ? "generated_workout" : null },
  });

  const context = await buildChatContext(athleteId, focusedWorkoutId);

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
    await saveAssistant(athleteId, "No pude responder en este momento. Probá de nuevo en unos minutos.", focusedWorkoutId);
    revalidatePath("/chat");
    return;
  }
  const { text, updatedBlocks, blocksUnreadable } = parseClaudeResponse(reply.text);

  // Resultado REAL de la edición: el texto del modelo puede decir "listo, lo cambié" aunque no se haya aplicado
  let notice: string | null = null;

  if (updatedBlocks !== null || blocksUnreadable) {
    if (blocksUnreadable) {
      notice = reply.truncated
        ? "La respuesta se cortó antes de terminar el cambio, así que no lo apliqué. Pedímelo de nuevo."
        : "No pude leer el cambio propuesto, así que no lo apliqué. Pedímelo de nuevo.";
    } else if (!focusedWorkoutId) {
      notice = "No apliqué ningún cambio: para editar una sesión abrí el chat desde «Pedir ajustes» en esa sesión.";
    } else {
      const workout = await prisma.generatedWorkout.findFirst({ where: { id: focusedWorkoutId, athleteId } });
      if (!workout) notice = "No encontré esa sesión, no apliqué el cambio.";
      else if (workout.status === "SENT_TO_INTERVALS" || workout.status === "COMPLETED")
        notice = "Esta sesión ya fue enviada a Intervals (o completada), por eso no apliqué el cambio: quedaría distinta a la del calendario.";
      else if (!me?.ftp) notice = "Configurá tu FTP para poder editar sesiones; no apliqué el cambio.";
      else {
        const original = (workout.blocksJson as unknown as { durationSec: number }[]).reduce((s, b) => s + (b.durationSec ?? 0), 0);
        const check = validateBlocks(updatedBlocks, { ftp: me.ftp, originalTotalSec: original });
        if (!check.ok) notice = `No apliqué el cambio porque no pasó la validación (${check.reason}).`;
        else {
          // Se recalcula TODO lo derivado (TSS, kJ, carbos) en el mismo paso
          const tss = calculateTss(check.blocks, me.ftp);
          const fueling = calculateFueling(check.blocks);
          await prisma.generatedWorkout.update({
            where: { id: workout.id },
            data: {
              blocksJson: check.blocks,
              estimatedTss: tss,
              estimatedKj: fueling.totalKj,
              suggestedCarbsG: fueling.suggestedCarbsG,
              suggestedCarbsGPerHour: fueling.suggestedCarbsGPerHour,
              requiresMultipleCarbSources: fueling.requiresMultipleCarbSources,
              status: "EDITED",
            },
          });
        }
      }
    }
  }

  const finalText = notice ? `⚠ ${notice}\n\n${text}` : reply.truncated ? `${text}\n\n(La respuesta se cortó por largo.)` : text;
  await saveAssistant(athleteId, finalText, focusedWorkoutId);

  revalidatePath("/chat");
  revalidatePath("/dashboard");
}
