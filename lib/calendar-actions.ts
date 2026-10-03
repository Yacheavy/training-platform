"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createEvent } from "@/lib/intervals-client";
import { buildStructuredWorkout } from "@/lib/training-engine/workout-description";
import { revalidatePath } from "next/cache";

export async function moveWorkoutToDate(workoutId: string, newDateISO: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout || workout.athleteId !== session.user.id) throw new Error("Workout no encontrado");

  const newDate = new Date(newDateISO);
  newDate.setHours(0, 0, 0, 0);

  await prisma.generatedWorkout.update({
    where: { id: workoutId },
    data: { date: newDate },
  });

  if (workout.status === "SENT_TO_INTERVALS") {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    const apiKey = process.env.INTERVALS_API_KEY_DEV!;
    const athleteIntervalsId = process.env.INTERVALS_ATHLETE_ID_DEV!;

    const blocks = workout.blocksJson as unknown as { type: string; durationSec: number; targetWatts: number }[];
    const totalDurationSec = blocks.reduce((s, b) => s + b.durationSec, 0);
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
    const startDateLocal = newDate.toISOString().split("T")[0] + "T07:00:00";

    await createEvent(athleteIntervalsId, apiKey, {
      external_id: workout.id,
      name: `${workout.workoutLibraryKey} (movido)`,
      startDateLocal,
      description,
      movingTimeSec: totalDurationSec,
    });
  }

  revalidatePath("/calendar");
}

export async function swapWorkouts(workoutIdA: string, workoutIdB: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const [workoutA, workoutB] = await Promise.all([
    prisma.generatedWorkout.findUnique({ where: { id: workoutIdA } }),
    prisma.generatedWorkout.findUnique({ where: { id: workoutIdB } }),
  ]);
  if (!workoutA || !workoutB) throw new Error("Workout no encontrado");
  if (workoutA.athleteId !== session.user.id || workoutB.athleteId !== session.user.id) {
    throw new Error("No autorizado");
  }

  const dateA = workoutA.date;
  const dateB = workoutB.date;

  await prisma.$transaction([
    prisma.generatedWorkout.update({ where: { id: workoutIdA }, data: { date: dateB } }),
    prisma.generatedWorkout.update({ where: { id: workoutIdB }, data: { date: dateA } }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const apiKey = process.env.INTERVALS_API_KEY_DEV!;
  const athleteIntervalsId = process.env.INTERVALS_ATHLETE_ID_DEV!;

  const pairs: [typeof workoutA, Date][] = [
    [workoutA, dateB],
    [workoutB, dateA],
  ];

  for (const [workout, newDate] of pairs) {
    if (workout.status === "SENT_TO_INTERVALS") {
      const blocks = workout.blocksJson as unknown as { type: string; durationSec: number; targetWatts: number }[];
      const totalDurationSec = blocks.reduce((s, b) => s + b.durationSec, 0);
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
      const startDateLocal = newDate.toISOString().split("T")[0] + "T07:00:00";
      await createEvent(athleteIntervalsId, apiKey, {
        external_id: workout.id,
        name: `${workout.workoutLibraryKey} (enroque)`,
        startDateLocal,
        description,
        movingTimeSec: totalDurationSec,
      });
    }
  }

  revalidatePath("/calendar");
}