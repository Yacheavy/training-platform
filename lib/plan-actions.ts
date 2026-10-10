"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runRegeneration, regenerationQuery } from "@/lib/plan-core";

/**
 * Regenera las sesiones PLANNED desde hoy en adelante con la plantilla, el FTP y la
 * potencia en VO2max actuales. Reemplaza también las aprobadas y enviadas (se reenvían a Intervals
 * actualizando el mismo evento). No toca el pasado, las completadas ni las editadas a mano.
 */
export async function regeneratePlan() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const r = await runRegeneration(session.user.id);

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/settings");
  revalidatePath("/planificacion");
  redirect(`/planificacion?${regenerationQuery(r)}`);
}
