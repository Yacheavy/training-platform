"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { regenerateBlocks } from "@/lib/training-engine/regenerate";
import { dayStartLocal } from "@/lib/tz";
import { pushWorkoutToIntervals } from "@/lib/push-workout";

/**
 * Regenera las sesiones PLANNED desde hoy en adelante con la plantilla, el FTP y la
 * potencia en VO2max actuales. Reemplaza también las aprobadas y enviadas (se reenvían a Intervals
 * actualizando el mismo evento). No toca el pasado, las completadas ni las editadas a mano.
 */
export async function regeneratePlan() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const athleteId = session.user.id;
  const from = dayStartLocal(new Date());

  const kept = await prisma.generatedWorkout.count({ where: { athleteId, status: "EDITED", date: { gte: from } } });
  let created = 0;
  const resend: string[] = [];
  let resent = 0;
  let resendFailed = 0;
  const warnings: string[] = [];
  const r = await regenerateBlocks(prisma, athleteId, from);
  created = r.created;
  const skipped = r.skipped;
  const failedBlocks = r.failedBlocks;
  resend.push(...r.resend);
  warnings.push(...r.warnings);

  // Las que ya estaban en Intervals se actualizan solas (mismo evento)
  for (const id of resend) {
    try { await pushWorkoutToIntervals(athleteId, id); resent++; } catch { resendFailed++; }
  }

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/settings");
  revalidatePath("/planificacion");
  redirect(`/planificacion?regenerated=${created}&kept=${kept}&resent=${resent}&failed=${resendFailed}${warnings.length ? `&warnings=${warnings.length}` : ""}${skipped ? `&skipped=${skipped}` : ""}${failedBlocks.length ? `&blockerr=${encodeURIComponent(failedBlocks.join(", "))}` : ""}`);
}
