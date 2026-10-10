import { prisma } from "@/lib/prisma";
import { regenerateBlocks } from "@/lib/training-engine/regenerate";
import { dayStartLocal } from "@/lib/tz";
import { pushWorkoutToIntervals } from "@/lib/push-workout";
import { RACE_WARMUP_KEY } from "@/lib/training-engine/race-week";

/** Resultado de regenerar el plan de un atleta. NO es una acción de servidor: el id ya viene autorizado. */
export interface RegenerationResult {
  created: number;
  kept: number;
  resent: number;
  resendFailed: number;
  warnings: number;
  skipped: number;
  failedBlocks: string[];
}

/** Regenera las sesiones planificadas desde hoy (ver regeneratePlan) y reenvía a Intervals las que ya estaban allí. */
export async function runRegeneration(athleteId: string, coachNote?: string): Promise<RegenerationResult> {
  const from = dayStartLocal(new Date());
  const kept = await prisma.generatedWorkout.count({ where: { athleteId, status: "EDITED", date: { gte: from } } });
  const r = await regenerateBlocks(prisma, athleteId, from, new Date(), coachNote);
  let resent = 0;
  let resendFailed = 0;
  for (const id of r.resend) {
    try { await pushWorkoutToIntervals(athleteId, id); resent++; } catch { resendFailed++; }
  }
  return { created: r.created, kept, resent, resendFailed, warnings: r.warnings.length, skipped: r.skipped, failedBlocks: r.failedBlocks };
}

/** Parámetros de la URL con el resumen que muestra la pantalla de planificación. */
export function regenerationQuery(r: RegenerationResult): string {
  return `regenerated=${r.created}&kept=${r.kept}&resent=${r.resent}&failed=${r.resendFailed}${r.warnings ? `&warnings=${r.warnings}` : ""}${r.skipped ? `&skipped=${r.skipped}` : ""}${r.failedBlocks.length ? `&blockerr=${encodeURIComponent(r.failedBlocks.join(", "))}` : ""}`;
}

/**
 * Borra las sesiones planificadas de un bloque (no toca completadas, editadas ni enviadas a mano).
 * El calentamiento del día de la carrera cae el día en que termina el bloque, así que se borra aparte (salvo que otro bloque empiece ese día).
 */
export async function deletePlannedSessionsOfBlock(athleteId: string, block: { startDate: Date; endDate: Date }) {
  const status = { in: ["PLANNED", "SUGGESTED"] as ("PLANNED" | "SUGGESTED")[] };
  await prisma.generatedWorkout.deleteMany({ where: { athleteId, status, date: { gte: block.startDate, lt: block.endDate } } });
  const nextStarts = await prisma.trainingBlock.findFirst({ where: { athleteId, startDate: block.endDate }, select: { id: true } });
  if (!nextStarts) {
    await prisma.generatedWorkout.deleteMany({
      where: { athleteId, status, workoutLibraryKey: RACE_WARMUP_KEY, date: { gte: block.endDate, lt: new Date(block.endDate.getTime() + 24 * 60 * 60 * 1000) } },
    });
  }
}
