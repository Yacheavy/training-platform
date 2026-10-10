"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { pushWorkoutToIntervals } from "@/lib/push-workout";
import { revalidatePath } from "next/cache";
import { generateFullPlan } from "@/lib/training-engine/generate-full-plan";
import { adaptForIndoor } from "@/lib/training-engine/indoor";
import { calculateTss, calculateKilojoules, type WorkoutBlock } from "@/lib/training-engine/tss";
import { calculateFueling } from "@/lib/training-engine/fueling";
import type { Prisma } from "@/app/generated/prisma";
import { isOffBike } from "@/lib/training-engine/off-bike";

export async function approveWorkout(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const workoutId = String(formData.get("workoutId"));
  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout || workout.athleteId !== session.user.id) throw new Error("Workout no encontrado");

  if (workout.status !== "PLANNED" && workout.status !== "SUGGESTED" && workout.status !== "EDITED") throw new Error("Esta sesión ya fue aprobada, enviada o completada");

  await prisma.generatedWorkout.update({
    where: { id: workoutId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/workouts/${workoutId}`);
}

export async function sendWorkoutToIntervals(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const workoutId = String(formData.get("workoutId"));
  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout || workout.athleteId !== session.user.id) throw new Error("Workout no encontrado");
  if (workout.status !== "APPROVED" && workout.status !== "EDITED") throw new Error("Aprobalo primero");

  await pushWorkoutToIntervals(session.user.id, workoutId);
  revalidatePath("/dashboard");
  revalidatePath(`/workouts/${workoutId}`);
}

/**
 * Regenera UNA sesión con el FTP, la potencia en VO2max, la plantilla y la preferencia de estímulo actuales.
 * Reemplaza la sesión aunque ya esté aprobada o enviada (no si está completada). Si estaba confirmada
 * queda aprobada: hay que volver a enviarla a Intervals (se actualiza el mismo evento).
 */
export async function regenerateWorkout(formData: FormData) {
  await regenerateInner(formData, false);
}

/** "Otra variante": regenera la sesión del día excluyendo la variante actual. */
export async function alternativeWorkout(formData: FormData) {
  await regenerateInner(formData, true);
}

async function regenerateInner(formData: FormData, excludeCurrent: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const workoutId = String(formData.get("workoutId"));
  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout || workout.athleteId !== session.user.id) throw new Error("Workout no encontrado");
  if (workout.status === "COMPLETED") throw new Error("La sesión ya está completada");

  const block = await prisma.trainingBlock.findFirst({
    where: { athleteId: session.user.id, startDate: { lte: workout.date }, endDate: { gte: workout.date } },
  });
  if (!block) throw new Error("Esa fecha no pertenece a ningún bloque de entrenamiento");

  const r = await generateFullPlan(block.id, {
    athleteId: session.user.id,
    fromDate: workout.date,
    replaceDate: workout.date,
    excludeKeys: excludeCurrent ? [workout.workoutLibraryKey] : undefined,
  });
  if (r.created === 0) throw new Error("El plan actual no tiene una sesión para ese día (revisá la plantilla semanal)");
  if (excludeCurrent) {
    const after = await prisma.generatedWorkout.findUnique({ where: { id: workoutId }, select: { workoutLibraryKey: true } });
    if (after?.workoutLibraryKey === workout.workoutLibraryKey) throw new Error("No hay otra variante disponible para este día con tus reglas (vetadas, descarga, separación entre sesiones duras)");
  }
  // Si ya estaba en Intervals, se actualiza ahí en el mismo paso (si falla, queda aprobada para reenviar)
  for (const id of r.resendIds) {
    try { await pushWorkoutToIntervals(session.user.id, id); } catch (err) { console.error("Reenvío tras regenerar falló:", err); }
  }

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath(`/workouts/${workoutId}`);
}

/** "Pasar a rodillo": misma variante adaptada al interior (tope de duración + notas). Regenerar vuelve a ruta. */
export async function moveWorkoutIndoor(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const workoutId = String(formData.get("workoutId"));
  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout || workout.athleteId !== session.user.id) throw new Error("Workout no encontrado");
  if (workout.status === "COMPLETED") throw new Error("La sesión ya está completada");
  if (isOffBike(workout.workoutLibraryKey)) throw new Error("Esta sesión no es en bici: no se pasa a rodillo");
  if (workout.environment === "indoor") throw new Error("La sesión ya está en rodillo");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { ftp: true } });
  if (!user?.ftp) throw new Error("Falta el FTP");

  const ad = adaptForIndoor(workout.blocksJson as unknown as WorkoutBlock[], workout.workoutLibraryKey);
  const fuel = calculateFueling(ad.blocks, user.ftp);
  const wasSent = workout.status === "SENT_TO_INTERVALS";
  const wasConfirmed = ["APPROVED", "EDITED", "SENT_TO_INTERVALS"].includes(workout.status);
  await prisma.generatedWorkout.update({
    where: { id: workoutId },
    data: {
      environment: "indoor",
      blocksJson: ad.blocks as unknown as Prisma.InputJsonValue,
      estimatedTss: calculateTss(ad.blocks, user.ftp),
      estimatedKj: calculateKilojoules(ad.blocks),
      suggestedCarbsG: fuel.suggestedCarbsG,
      suggestedCarbsGPerHour: fuel.suggestedCarbsGPerHour,
      requiresMultipleCarbSources: fuel.requiresMultipleCarbSources,
      rationale: `${workout.rationale ?? ""} · ${ad.note}`.replace(/^ · /, ""),
      status: wasConfirmed ? "APPROVED" : workout.status,
      sentToIntervalsAt: null,
    },
  });
  if (wasSent) {
    try { await pushWorkoutToIntervals(session.user.id, workoutId); } catch (err) { console.error("Reenvío tras pasar a rodillo falló:", err); }
  }
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath(`/workouts/${workoutId}`);
}
