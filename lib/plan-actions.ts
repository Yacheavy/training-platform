"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateFullPlan } from "@/lib/training-engine/generate-full-plan";
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

  const blocks = await prisma.trainingBlock.findMany({ where: { athleteId, endDate: { gte: from } }, orderBy: { startDate: "asc" } });
  const kept = await prisma.generatedWorkout.count({ where: { athleteId, status: "EDITED", date: { gte: from } } });
  let created = 0;
  const resend: string[] = [];
  let resent = 0;
  let resendFailed = 0;
  const warnings: string[] = [];
  for (const b of blocks) {
    await prisma.generatedWorkout.deleteMany({
      where: { athleteId, status: { in: ["PLANNED", "SUGGESTED"] }, date: { gte: from, lt: new Date(b.endDate.getTime() + 24 * 60 * 60 * 1000) } },
    });
    const r = await generateFullPlan(b.id, { fromDate: from, athleteId, replaceAll: true });
    created += r.created;
    resend.push(...r.resendIds);
    warnings.push(...r.warnings);
  }

  // Las que ya estaban en Intervals se actualizan solas (mismo evento)
  for (const id of resend) {
    try { await pushWorkoutToIntervals(athleteId, id); resent++; } catch { resendFailed++; }
  }

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/settings");
  revalidatePath("/planificacion");
  redirect(`/planificacion?regenerated=${created}&kept=${kept}&resent=${resent}&failed=${resendFailed}${warnings.length ? `&warnings=${warnings.length}` : ""}`);
}
