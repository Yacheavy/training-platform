"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createEvent } from "@/lib/intervals-client";
import { buildStructuredWorkout } from "@/lib/training-engine/workout-description";
import { revalidatePath } from "next/cache";
import { generateFullPlan } from "@/lib/training-engine/generate-full-plan";
import { getIntervalsCreds } from "@/lib/intervals-creds";
import { dateKeyLocal } from "@/lib/tz";
import { buildWorkoutName } from "@/lib/training-engine/workout-naming";

export async function approveWorkout(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const workoutId = String(formData.get("workoutId"));
  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout || workout.athleteId !== session.user.id) throw new Error("Workout no encontrado");

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

  const creds = await getIntervalsCreds(session.user.id);
  if (!creds) throw new Error("Conectá tu Intervals en Configuración antes de enviar sesiones");
  const apiKey = creds.apiKey;
  const athleteIntervalsId = creds.athleteId;

  const blocks = workout.blocksJson as unknown as { type: string; durationSec: number; targetWatts: number }[];
  const totalDurationSec = blocks.reduce((s, b) => s + b.durationSec, 0);
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const description = buildStructuredWorkout(
    blocks,
    user!.ftp!,
    {
      totalKj: workout.estimatedKj ?? 0,
      suggestedCarbsG: workout.suggestedCarbsG ?? 0,
      suggestedCarbsGPerHour: workout.suggestedCarbsGPerHour ?? 0,
      requiresMultipleCarbSources: workout.requiresMultipleCarbSources,
    },
    workout.rationale
  );
  const startDateLocal = dateKeyLocal(new Date(workout.date)) + "T07:00:00";

  await createEvent(athleteIntervalsId, apiKey, {
    external_id: workout.id,
    name: buildWorkoutName(workout.workoutLibraryKey, blocks, user!.ftp!),
    startDateLocal,
    description,
    movingTimeSec: totalDurationSec,
  });

  await prisma.generatedWorkout.update({
    where: { id: workoutId },
    data: { status: "SENT_TO_INTERVALS", sentToIntervalsAt: new Date() },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/workouts/${workoutId}`);
}

/**
 * Regenera UNA sesión con el FTP, la potencia en VO2max, la plantilla y la preferencia de estímulo actuales.
 * Reemplaza la sesión aunque ya esté aprobada o enviada (no si está completada). Si estaba confirmada
 * queda aprobada: hay que volver a enviarla a Intervals (se actualiza el mismo evento).
 */
export async function regenerateWorkout(formData: FormData) {
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

  const r = await generateFullPlan(block.id, { athleteId: session.user.id, fromDate: workout.date, replaceDate: workout.date });
  if (r.created === 0) throw new Error("El plan actual no tiene una sesión para ese día (revisá la plantilla semanal)");

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath(`/workouts/${workoutId}`);
}
