"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateFullPlan } from "@/lib/training-engine/generate-full-plan";
import { dayStartLocal, dateKeyLocal } from "@/lib/tz";
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
  let skipped = 0;
  const failedBlocks: string[] = [];
  const dayUtc = (d: Date) => new Date(dateKeyLocal(d) + "T00:00:00Z");
  const startKeys = new Set(blocks.map((x) => dateKeyLocal(x.startDate)));
  for (const b of blocks) {
    // Solo se borra la ventana de ESTE bloque. Antes el borrado iba desde hoy hasta el final del bloque,
    // así que al procesar el bloque siguiente se borraban las sesiones recién creadas del anterior.
    const lo = new Date(Math.max(from.getTime(), dayUtc(b.startDate).getTime()));
    const endKey = dateKeyLocal(b.endDate);
    // El día de fin pertenece al bloque siguiente si este empieza ese mismo día
    const hi = new Date(dayUtc(b.endDate).getTime() + (startKeys.has(endKey) ? 0 : 24 * 60 * 60 * 1000));
    try {
      await prisma.generatedWorkout.deleteMany({
        where: { athleteId, status: { in: ["PLANNED", "SUGGESTED"] }, date: { gte: lo, lt: hi } },
      });
      const r = await generateFullPlan(b.id, { fromDate: from, athleteId, replaceAll: true });
      created += r.created;
      skipped += r.skipped;
      resend.push(...r.resendIds);
      warnings.push(...r.warnings);
    } catch (e) {
      console.error("regeneratePlan: falló el bloque", b.name, e);
      failedBlocks.push(b.name);
    }
  }

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
