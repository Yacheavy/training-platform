"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { applySeasonCore } from "@/lib/season-apply";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

/** Crea los bloques propuestos (se recalculan en el servidor, no se confía en el cliente) y genera sus sesiones en orden. */
export async function applySeason(): Promise<{ error: string } | { blocks: number; sessions: number }> {
  try {
    const athleteId = await requireUserId();
    const r = await applySeasonCore(prisma, athleteId);
    if ("error" in r) return r;
    const { blocks, sessions } = r;
    revalidatePath("/settings");
    revalidatePath("/planificacion");
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    return { blocks, sessions };
  } catch (e) {
    console.error("applySeason falló", e);
    return { error: e instanceof Error && e.message ? `No se pudo crear la temporada: ${e.message}` : "No se pudo crear la temporada. Probá de nuevo." };
  }
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
  revalidatePath("/planificacion");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
}
