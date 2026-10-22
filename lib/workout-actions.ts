"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { pushWorkoutToIntervals } from "@/lib/push-workout";
import { revalidatePath } from "next/cache";
import { generateFullPlan } from "@/lib/training-engine/generate-full-plan";
import { adaptForIndoor, indoorCapMin } from "@/lib/training-engine/indoor";
import { calculateTss, calculateKilojoules, type WorkoutBlock } from "@/lib/training-engine/tss";
import { calculateFueling } from "@/lib/training-engine/fueling";
import type { Prisma } from "@/app/generated/prisma";
import { VARIANTS } from "@/lib/training-engine/variants";
import { isOffBike } from "@/lib/training-engine/off-bike";
import { dayRangeLocal } from "@/lib/tz";
import { authorizeAthlete } from "@/lib/access";

export async function approveWorkout(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const workoutId = String(formData.get("workoutId"));
  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout) throw new Error("Workout no encontrado");
  const athleteId = await authorizeAthlete(workout.athleteId, session.user.id);

  if (workout.status !== "PLANNED" && workout.status !== "SUGGESTED" && workout.status !== "EDITED") throw new Error("Esta sesión ya fue aprobada, enviada o completada");

  await prisma.generatedWorkout.update({
    where: { id: workoutId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/alumnos/${athleteId}`);
  revalidatePath(`/workouts/${workoutId}`);
}

export async function sendWorkoutToIntervals(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const workoutId = String(formData.get("workoutId"));
  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout) throw new Error("Workout no encontrado");
  const athleteId = await authorizeAthlete(workout.athleteId, session.user.id);
  if (workout.status !== "APPROVED" && workout.status !== "EDITED") throw new Error("Aprobalo primero");

  await pushWorkoutToIntervals(athleteId, workoutId);
  revalidatePath("/dashboard");
  revalidatePath(`/alumnos/${athleteId}`);
  revalidatePath(`/workouts/${workoutId}`);
}

/** Un solo paso: aprueba la sesión (si hacía falta) y la envía a Intervals. */
export async function approveAndSendWorkout(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const workoutId = String(formData.get("workoutId"));
  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout) throw new Error("Workout no encontrado");
  const athleteId = await authorizeAthlete(workout.athleteId, session.user.id);
  if (!["PLANNED", "SUGGESTED", "EDITED", "APPROVED", "SENT_TO_INTERVALS"].includes(workout.status)) throw new Error("Esta sesión ya fue completada");

  // Una sesión ya enviada se vuelve a enviar tal cual (actualiza el mismo evento de Intervals)
  if (workout.status === "PLANNED" || workout.status === "SUGGESTED") {
    await prisma.generatedWorkout.update({ where: { id: workoutId }, data: { status: "APPROVED", approvedAt: new Date() } });
  }
  // Si Intervals falla queda aprobada: se puede reintentar sin perder nada
  await pushWorkoutToIntervals(athleteId, workoutId);
  revalidatePath("/dashboard");
  revalidatePath(`/alumnos/${athleteId}`);
  revalidatePath("/calendar");
  revalidatePath(`/workouts/${workoutId}`);
}

/**
 * «Enviar la semana»: aprueba y envía a Intervals las sesiones pendientes de una semana (formData.weekStart = inicio en ms)
 * o, sin ese dato, de hoy y los 6 días siguientes. Nunca toca días pasados.
 * Las que ya están en Intervals no se tocan (los cambios posteriores las actualizan solos). Las completadas tampoco.
 */
export async function sendWeekToIntervals(formData?: FormData): Promise<{ error: string } | { sent: number }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const targetId = String(formData?.get("athleteId") ?? "");
  const athleteId = targetId ? await authorizeAthlete(targetId, session.user.id) : session.user.id;

  const today = dayRangeLocal(new Date()).start;
  const ws = Number(formData?.get("weekStart"));
  const from = Number.isFinite(ws) && ws > 0 ? new Date(Math.max(ws, today.getTime())) : today;
  const end = Number.isFinite(ws) && ws > 0 ? new Date(ws + 7 * 24 * 60 * 60 * 1000) : new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const pending = await prisma.generatedWorkout.findMany({
    where: { athleteId, date: { gte: from, lt: end }, status: { in: ["PLANNED", "SUGGESTED", "EDITED", "APPROVED"] } },
    orderBy: { date: "asc" },
    select: { id: true, status: true },
  });
  if (pending.length === 0) return { error: "No hay sesiones pendientes de enviar en esa semana" };

  let sent = 0;
  const failed: string[] = [];
  for (const w of pending) {
    try {
      if (w.status === "PLANNED" || w.status === "SUGGESTED") {
        await prisma.generatedWorkout.update({ where: { id: w.id }, data: { status: "APPROVED", approvedAt: new Date() } });
      }
      await pushWorkoutToIntervals(athleteId, w.id);
      sent++;
    } catch (err) {
      console.error("Envío de la semana: falló una sesión:", err);
      failed.push(err instanceof Error ? err.message : "error");
    }
  }
  revalidatePath("/dashboard");
  revalidatePath(`/alumnos/${athleteId}`);
  revalidatePath("/calendar");
  if (failed.length > 0) {
    return { error: `Se enviaron ${sent} de ${pending.length}. ${failed[0]}. Las que faltan quedaron aprobadas: probá de nuevo.` };
  }
  return { sent };
}

/**
 * Regenera UNA sesión con el FTP, la potencia en VO2max, la plantilla y la preferencia de estímulo actuales.
 * Reemplaza la sesión aunque ya esté aprobada o enviada (no si está completada). Si estaba confirmada
 * queda aprobada: hay que volver a enviarla a Intervals (se actualiza el mismo evento).
 */
export async function regenerateWorkout(formData: FormData) {
  return regenerateInner(formData, false);
}

/** "Otra variante": regenera la sesión del día excluyendo la variante actual. */
export async function alternativeWorkout(formData: FormData) {
  return regenerateInner(formData, true);
}

async function regenerateInner(formData: FormData, excludeCurrent: boolean): Promise<{ error: string } | undefined> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const workoutId = String(formData.get("workoutId"));
  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout) throw new Error("Workout no encontrado");
  const athleteId = await authorizeAthlete(workout.athleteId, session.user.id);
  if (workout.status === "COMPLETED") throw new Error("La sesión ya está completada");

  const block = await prisma.trainingBlock.findFirst({
    where: { athleteId, startDate: { lte: workout.date }, endDate: { gte: workout.date } },
  });
  if (!block) throw new Error("Esa fecha no pertenece a ningún bloque de entrenamiento");

  const indoor = workout.environment === "indoor";
  // En rodillo, «Otra variante» sigue en rodillo y prefiere variantes que funcionan bien adentro (si no hay otra, usa cualquiera)
  const limited = indoor && excludeCurrent ? Object.values(VARIANTS).filter((v) => v.indoor === "limited").map((v) => v.key) : [];
  const run = (exclude: string[] | undefined) =>
    generateFullPlan(block.id, { athleteId: workout.athleteId, fromDate: workout.date, replaceDate: workout.date, excludeKeys: exclude, keepIndoor: indoor });
  const base = excludeCurrent ? [workout.workoutLibraryKey] : undefined;
  let r = await run(excludeCurrent && limited.length ? [...base!, ...limited] : base);
  if (r.created > 0 && excludeCurrent && limited.length) {
    const chk = await prisma.generatedWorkout.findUnique({ where: { id: workoutId }, select: { workoutLibraryKey: true } });
    if (chk?.workoutLibraryKey === workout.workoutLibraryKey) r = await run(base);
  }
  if (r.created === 0) throw new Error("El plan actual no tiene una sesión para ese día (revisá la plantilla semanal)");
  if (excludeCurrent) {
    const after = await prisma.generatedWorkout.findUnique({ where: { id: workoutId }, select: { workoutLibraryKey: true } });
    if (after?.workoutLibraryKey === workout.workoutLibraryKey) throw new Error("No hay otra variante disponible para este día con tus reglas (vetadas, descarga, separación entre sesiones duras)");
  }
  // Si ya estaba en Intervals, se actualiza ahí en el mismo paso (si falla, queda aprobada para reenviar)
  let resendError: string | null = null;
  for (const id of r.resendIds) {
    try { await pushWorkoutToIntervals(athleteId, id); } catch (err) {
      console.error("Reenvío tras regenerar falló:", err);
      resendError = err instanceof Error ? err.message : "error";
    }
  }

  revalidatePath("/dashboard");
  revalidatePath(`/alumnos/${athleteId}`);
  revalidatePath("/calendar");
  revalidatePath(`/workouts/${workoutId}`);
  if (resendError) return { error: `La sesión se regeneró pero no se pudo actualizar en Intervals (${resendError}). Quedó aprobada: usá «Enviar a Intervals».` };
}

/** "Pasar a rodillo": misma variante adaptada al interior (tope de duración + notas). Regenerar vuelve a ruta. */
export async function moveWorkoutIndoor(formData: FormData): Promise<{ error: string } | undefined> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const workoutId = String(formData.get("workoutId"));
  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout) throw new Error("Workout no encontrado");
  const athleteId = await authorizeAthlete(workout.athleteId, session.user.id);
  if (workout.status === "COMPLETED") throw new Error("La sesión ya está completada");
  if (isOffBike(workout.workoutLibraryKey)) throw new Error("Esta sesión no es en bici: no se pasa a rodillo");
  const curSec = (workout.blocksJson as unknown as WorkoutBlock[]).reduce((t, b) => t + b.durationSec, 0);
  // Si ya está en rodillo pero supera el tope (sesiones pasadas antes de que existiera el tope), se vuelve a ajustar
  if (workout.environment === "indoor" && curSec <= indoorCapMin(workout.blocksJson as unknown as WorkoutBlock[]) * 60) throw new Error("La sesión ya está en rodillo");
  const user = await prisma.user.findUnique({ where: { id: athleteId }, select: { ftp: true } });
  if (!user?.ftp) throw new Error("Falta el FTP");

  const ad = adaptForIndoor(workout.blocksJson as unknown as WorkoutBlock[], workout.workoutLibraryKey);
  const fuel = calculateFueling(ad.blocks, user.ftp);
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
      rationale: `${(workout.rationale ?? "").split(" · ").filter((p) => !p.startsWith("Rodillo:") && !p.startsWith("se acortó") && !p.startsWith("los intervalos largos")).join(" · ")} · ${ad.note}`.replace(/^ · /, ""),
      status: wasConfirmed ? "APPROVED" : workout.status,
      sentToIntervalsAt: null,
    },
  });
  let pushError: string | null = null;
  // Toda sesión confirmada (aprobada, editada o enviada) se actualiza en Intervals en el mismo paso
  if (wasConfirmed) {
    try { await pushWorkoutToIntervals(athleteId, workoutId); } catch (err) {
      console.error("Reenvío tras pasar a rodillo falló:", err);
      pushError = err instanceof Error ? err.message : "error";
    }
  }
  revalidatePath("/dashboard");
  revalidatePath(`/alumnos/${athleteId}`);
  revalidatePath("/calendar");
  revalidatePath(`/workouts/${workoutId}`);
  if (pushError) return { error: `Se ajustó la sesión pero no se pudo actualizar en Intervals (${pushError}). Quedó aprobada: usá «Enviar a Intervals».` };
}
