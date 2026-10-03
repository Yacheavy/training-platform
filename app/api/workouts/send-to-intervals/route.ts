import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createEvent } from "@/lib/intervals-client";
import { buildStructuredWorkout } from "@/lib/training-engine/workout-description";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { workoutId } = await request.json();

  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout || workout.athleteId !== session.user.id) {
    return NextResponse.json({ error: "Workout no encontrado" }, { status: 404 });
  }
  if (workout.status !== "APPROVED") {
    return NextResponse.json({ error: "El workout debe estar aprobado antes de enviarlo" }, { status: 400 });
  }

  // Por ahora usamos las variables de entorno de desarrollo — en la versión
  // real esto viene de user.intervalsApiKeyEncrypted / intervalsAthleteId
  const apiKey = process.env.INTERVALS_API_KEY_DEV!;
  const athleteIntervalsId = process.env.INTERVALS_ATHLETE_ID_DEV!;

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

  const startDateLocal = new Date(workout.date).toISOString().split("T")[0] + "T07:00:00";

  const event = await createEvent(athleteIntervalsId, apiKey, {
    external_id: workout.id,
    name: `${workout.workoutLibraryKey} (generado)`,
    startDateLocal,
    description,
    movingTimeSec: totalDurationSec,
  });

  const updated = await prisma.generatedWorkout.update({
    where: { id: workoutId },
    data: { status: "SENT_TO_INTERVALS", sentToIntervalsAt: new Date() },
  });

  return NextResponse.json({ workout: updated, intervalsEvent: event });
}