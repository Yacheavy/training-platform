"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateFullPlan } from "@/lib/training-engine/generate-full-plan";
import { dayStartLocal } from "@/lib/tz";

/**
 * Regenera las sesiones PLANNED desde hoy en adelante con la plantilla, el FTP y la
 * potencia en VO2max actuales. No toca sesiones del pasado ni las ya aprobadas,
 * editadas, enviadas o completadas.
 */
export async function regeneratePlan() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const athleteId = session.user.id;
  const from = dayStartLocal(new Date());

  const blocks = await prisma.trainingBlock.findMany({ where: { athleteId, endDate: { gte: from } }, orderBy: { startDate: "asc" } });
  let created = 0;
  const warnings: string[] = [];
  for (const b of blocks) {
    await prisma.generatedWorkout.deleteMany({
      where: { athleteId, status: "PLANNED", date: { gte: from, lt: new Date(b.endDate.getTime() + 24 * 60 * 60 * 1000) } },
    });
    const r = await generateFullPlan(b.id, { fromDate: from, athleteId });
    created += r.created;
    warnings.push(...r.warnings);
  }

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/settings");
  redirect(`/settings?regenerated=${created}${warnings.length ? `&warnings=${warnings.length}` : ""}`);
}
