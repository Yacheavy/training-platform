import { prisma } from "@/lib/prisma";
import { regenerateBlocks } from "@/lib/training-engine/regenerate";
import { dayStartLocal } from "@/lib/tz";
import { pushWorkoutToIntervals } from "@/lib/push-workout";

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
