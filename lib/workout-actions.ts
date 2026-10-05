"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createEvent } from "@/lib/intervals-client";
import { buildStructuredWorkout } from "@/lib/training-engine/workout-description";
import { revalidatePath } from "next/cache";
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
  if (workout.status !== "APPROVED") throw new Error("Aprobalo primero");

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