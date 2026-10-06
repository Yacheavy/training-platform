"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { pushWorkoutToIntervals } from "@/lib/push-workout";
import { revalidatePath } from "next/cache";
import { generateFullPlan } from "@/lib/training-engine/generate-full-plan";

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
  // Si ya estaba en Intervals, se actualiza ahí en el mismo paso (si falla, queda aprobada para reenviar)
  for (const id of r.resendIds) {
    try { await pushWorkoutToIntervals(session.user.id, id); } catch (err) { console.error("Reenvío tras regenerar falló:", err); }
  }

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath(`/workouts/${workoutId}`);
}
