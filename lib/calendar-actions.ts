"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { pushWorkoutToIntervals } from "@/lib/push-workout";
import { revalidatePath } from "next/cache";
import { dayStartLocal } from "@/lib/tz";

export async function moveWorkoutToDate(workoutId: string, newDateISO: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout || workout.athleteId !== session.user.id) throw new Error("Workout no encontrado");
  if (workout.status === "COMPLETED") throw new Error("La sesión ya se realizó");

  const parsed = new Date(newDateISO);
  if (Number.isNaN(parsed.getTime())) throw new Error("Fecha inválida");
  // Mediodía del día local: el mismo día calendario tanto en hora local como en UTC
  const newDate = new Date(dayStartLocal(parsed).getTime() + 12 * 3600 * 1000);

  await prisma.generatedWorkout.update({ where: { id: workoutId }, data: { date: newDate } });
  if (workout.status === "SENT_TO_INTERVALS") {
    try {
      await pushWorkoutToIntervals(session.user.id, workoutId);
    } catch (err) {
      await prisma.generatedWorkout.update({ where: { id: workoutId }, data: { date: workout.date } });
      throw err;
    }
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
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
  if (workoutA.status === "COMPLETED" || workoutB.status === "COMPLETED") throw new Error("Una de las sesiones ya se realizó");

  const dateA = workoutA.date;
  const dateB = workoutB.date;

  await prisma.$transaction([
    prisma.generatedWorkout.update({ where: { id: workoutIdA }, data: { date: dateB } }),
    prisma.generatedWorkout.update({ where: { id: workoutIdB }, data: { date: dateA } }),
  ]);

  try {
    for (const w of [workoutA, workoutB]) {
      if (w.status === "SENT_TO_INTERVALS") await pushWorkoutToIntervals(session.user.id, w.id);
    }
  } catch (err) {
    // Se revierte: la app y Intervals no deben quedar con fechas distintas
    await prisma.$transaction([
      prisma.generatedWorkout.update({ where: { id: workoutIdA }, data: { date: dateA } }),
      prisma.generatedWorkout.update({ where: { id: workoutIdB }, data: { date: dateB } }),
    ]);
    throw err;
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}