"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { buildChatContext } from "@/lib/chat/context-builder";
import { askClaude } from "@/lib/chat/claude-client";
import { parseClaudeResponse } from "@/lib/chat/parse-response";
import { calculateTss } from "@/lib/training-engine/tss";
import { calculateFueling } from "@/lib/training-engine/fueling";
import { revalidatePath } from "next/cache";

export async function sendChatMessage(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const athleteId = session.user.id;
  const messageText = String(formData.get("message"));
  const focusedWorkoutId = formData.get("focusedWorkoutId") ? String(formData.get("focusedWorkoutId")) : undefined;

  if (!messageText.trim()) return;

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

  const rawReply = await askClaude(context, messageText, history);
  const { text, updatedBlocks } = parseClaudeResponse(rawReply);

  // Si el modelo devolvió bloques actualizados Y hay un workout enfocado,
  // recalculamos TODO lo derivado (TSS, kJ, carbos) — nunca se edita
  // blocksJson sin recalcular en el mismo paso, para no dejar el workout
  // con datos desincronizados
  if (updatedBlocks && focusedWorkoutId) {
    const workout = await prisma.generatedWorkout.findUnique({ where: { id: focusedWorkoutId } });
    const user = await prisma.user.findUnique({ where: { id: athleteId } });

    if (workout && workout.athleteId === athleteId && user?.ftp) {
      const tss = calculateTss(updatedBlocks, user.ftp);
      const fueling = calculateFueling(updatedBlocks);

      await prisma.generatedWorkout.update({
        where: { id: focusedWorkoutId },
        data: {
          blocksJson: updatedBlocks,
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

  await prisma.chatMessage.create({
    data: { athleteId, role: "assistant", content: text, focusedEntityId: focusedWorkoutId ?? null, focusedEntityType: focusedWorkoutId ? "generated_workout" : null },
  });

  revalidatePath("/chat");
  revalidatePath("/dashboard");
}