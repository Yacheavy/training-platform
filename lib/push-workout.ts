import { prisma } from "@/lib/prisma";
import { createEvent } from "@/lib/intervals-client";
import { buildStructuredWorkout } from "@/lib/training-engine/workout-description";
import { getIntervalsCreds } from "@/lib/intervals-creds";
import { dateKeyLocal } from "@/lib/tz";
import { buildWorkoutName } from "@/lib/training-engine/workout-naming";
import { isOffBike } from "@/lib/training-engine/off-bike";
import { gymToText, type GymSession } from "@/lib/training-engine/strength";

/** Crea o actualiza (por external_id = id de la sesión) el evento de Intervals de una sesión. */
export async function pushWorkoutToIntervals(athleteId: string, workoutId: string) {
  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout || workout.athleteId !== athleteId) throw new Error("Workout no encontrado");
  const creds = await getIntervalsCreds(athleteId);
  if (!creds) throw new Error("Conectá tu Intervals en Ajustes antes de enviar sesiones");
  const user = await prisma.user.findUnique({ where: { id: athleteId } });
  if (!user?.ftp) throw new Error("Falta el FTP");

  const blocks = workout.blocksJson as unknown as { type: string; durationSec: number; targetWatts: number; gym?: GymSession }[];

  // Gimnasio y flexibilidad: el detalle va como texto en la descripción y el evento no es un "Ride"
  if (isOffBike(workout.workoutLibraryKey)) {
    const gym = blocks.find((b) => b.gym)?.gym;
    const mins = Math.round(blocks.reduce((s, b) => s + b.durationSec, 0) / 60);
    const text = gym ? gymToText(gym) : "Sesión de gimnasio. Regenerá el plan en la app para ver los ejercicios.";
    await createEvent(creds.athleteId, creds.apiKey, {
      external_id: workout.id,
      name: `${workout.workoutLibraryKey === "flexibility" ? "FLEX" : "GYM"} ${mins}'${gym ? ` · ${gym.title}` : ""}`,
      startDateLocal: dateKeyLocal(new Date(workout.date)) + "T07:00:00",
      description: text,
      movingTimeSec: mins * 60,
      type: workout.workoutLibraryKey === "flexibility" ? "Yoga" : "WeightTraining",
    });
    await prisma.generatedWorkout.update({ where: { id: workoutId }, data: { status: "SENT_TO_INTERVALS", sentToIntervalsAt: new Date() } });
    return;
  }

  const description = buildStructuredWorkout(
    blocks,
    user.ftp,
    {
      totalKj: workout.estimatedKj ?? 0,
      suggestedCarbsG: workout.suggestedCarbsG ?? 0,
      suggestedCarbsGPerHour: workout.suggestedCarbsGPerHour ?? 0,
      requiresMultipleCarbSources: workout.requiresMultipleCarbSources,
    },
    workout.rationale
  );
  await createEvent(creds.athleteId, creds.apiKey, {
    external_id: workout.id,
    name: buildWorkoutName(workout.workoutLibraryKey, blocks, user.ftp) + (workout.environment === "indoor" ? " (rodillo)" : ""),
    startDateLocal: dateKeyLocal(new Date(workout.date)) + "T07:00:00",
    description,
    movingTimeSec: blocks.reduce((s, b) => s + b.durationSec, 0),
  });
  await prisma.generatedWorkout.update({ where: { id: workoutId }, data: { status: "SENT_TO_INTERVALS", sentToIntervalsAt: new Date() } });
}
