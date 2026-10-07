"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { getSeasonState, instantForKey } from "@/lib/season-data";
import { generateFullPlan } from "@/lib/training-engine/generate-full-plan";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

/** Crea los bloques propuestos (se recalculan en el servidor, no se confía en el cliente) y genera sus sesiones en orden. */
export async function applySeason() {
  const athleteId = await requireUserId();
  const user = await prisma.user.findUnique({ where: { id: athleteId }, select: { ftp: true } });
  if (!user?.ftp) throw new Error("Configurá tu FTP antes de generar la temporada");
  const state = await getSeasonState(athleteId);
  if (state.proposal.covered || state.proposal.blocks.length === 0) throw new Error("No hay bloques nuevos para crear");
  let sessions = 0;
  for (const b of state.proposal.blocks) {
    const block = await prisma.trainingBlock.create({
      data: { athleteId, name: b.name, objective: b.objective, startDate: instantForKey(state, b.startKey), endDate: instantForKey(state, b.endKey), plannedWeeklyTssProgression: [] },
    });
    const r = await generateFullPlan(block.id, { athleteId });
    sessions += r.created;
  }
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { blocks: state.proposal.blocks.length, sessions };
}

/** Elimina un bloque que todavía no empezó, con sus sesiones planificadas (no toca completadas, editadas ni enviadas a mano). */
export async function deleteFutureBlock(formData: FormData) {
  const athleteId = await requireUserId();
  const id = String(formData.get("blockId") ?? "");
  const block = await prisma.trainingBlock.findFirst({ where: { id, athleteId } });
  if (!block) throw new Error("Bloque no encontrado");
  if (block.startDate.getTime() <= Date.now()) throw new Error("Solo se pueden eliminar bloques que todavía no empezaron");
  await prisma.generatedWorkout.deleteMany({ where: { athleteId, status: { in: ["PLANNED", "SUGGESTED"] }, date: { gte: block.startDate, lt: block.endDate } } });
  await prisma.weeklyReview.deleteMany({ where: { trainingBlockId: id } });
  await prisma.trainingBlock.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
}
