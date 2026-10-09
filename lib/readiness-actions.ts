"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import type { Prisma } from "@/app/generated/prisma";
import { revalidatePath } from "next/cache";
import { dayRangeLocal } from "@/lib/tz";
import { calculateAvailability } from "@/lib/training-engine/availability";
import { proposeReadinessAdjustment } from "@/lib/training-engine/readiness-adjust";
import { calculateTss } from "@/lib/training-engine/tss";
import { calculateFueling } from "@/lib/training-engine/fueling";
import { pushWorkoutToIntervals } from "@/lib/push-workout";

/**
 * Aplica o descarta el ajuste sugerido por el semáforo del día sobre la sesión de hoy.
 * Todo se recalcula en el servidor (semáforo y propuesta); el cliente solo manda la decisión.
 * Queda una marca [CHECKIN:ESTADO:decisión] en el fundamento para no volver a preguntar.
 */
export async function decideReadinessAdjustment(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const athleteId = session.user.id;
  const workoutId = String(formData.get("workoutId"));
  const decision = String(formData.get("decision"));
  if (decision !== "apply" && decision !== "keep") throw new Error("Decisión inválida");

  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout || workout.athleteId !== athleteId) throw new Error("Sesión no encontrada");
  const { start, end } = dayRangeLocal(new Date());
  if (workout.date < start || workout.date >= end) throw new Error("Solo se puede ajustar la sesión de hoy");
  if (workout.status === "COMPLETED") throw new Error("La sesión ya se realizó");

  const availability = await calculateAvailability(athleteId);
  const marker = `[CHECKIN:${availability.status}:${decision === "apply" ? "aplicada" : "mantenida"}]`;

  if (decision === "keep") {
    await prisma.generatedWorkout.update({ where: { id: workoutId }, data: { rationale: `${workout.rationale ?? ""} · ${marker}` } });
  } else {
    const user = await prisma.user.findUnique({ where: { id: athleteId }, select: { ftp: true } });
    if (!user?.ftp) throw new Error("Cargá tu FTP en Ajustes primero");
    const blocks = workout.blocksJson as unknown as { type: string; durationSec: number; targetWatts: number }[];
    const proposal = proposeReadinessAdjustment(availability.status, workout.workoutLibraryKey, blocks, user.ftp);
    if (!proposal) throw new Error("Con el estado de hoy no hay un ajuste para proponer");

    const tss = calculateTss(proposal.newBlocks, user.ftp);
    const fueling = calculateFueling(proposal.newBlocks, user.ftp);
    const wasSent = workout.status === "SENT_TO_INTERVALS";
    const note = `Ajustada por tu estado de hoy (${availability.reasons.join("; ")}): ${proposal.label}`;
    await prisma.generatedWorkout.update({
      where: { id: workoutId },
      data: {
        workoutLibraryKey: proposal.newKey,
        blocksJson: proposal.newBlocks as unknown as Prisma.InputJsonValue,
        estimatedTss: tss,
        estimatedKj: fueling.totalKj,
        suggestedCarbsG: fueling.suggestedCarbsG,
        suggestedCarbsGPerHour: fueling.suggestedCarbsGPerHour,
        requiresMultipleCarbSources: fueling.requiresMultipleCarbSources,
        rationale: `${workout.rationale ?? ""} · ${note} · ${marker}`,
        status: wasSent ? workout.status : workout.status === "APPROVED" ? "APPROVED" : "EDITED",
      },
    });
    if (wasSent) {
      try {
        await pushWorkoutToIntervals(athleteId, workoutId);
      } catch (err) {
        // Si Intervals falla se revierte: app e Intervals no deben quedar distintos
        await prisma.generatedWorkout.update({
          where: { id: workoutId },
          data: {
            workoutLibraryKey: workout.workoutLibraryKey,
            blocksJson: workout.blocksJson as never,
            estimatedTss: workout.estimatedTss,
            estimatedKj: workout.estimatedKj,
            suggestedCarbsG: workout.suggestedCarbsG,
            suggestedCarbsGPerHour: workout.suggestedCarbsGPerHour,
            requiresMultipleCarbSources: workout.requiresMultipleCarbSources,
            rationale: workout.rationale,
            status: workout.status,
          },
        });
        throw err;
      }
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath(`/workouts/${workoutId}`);
}
