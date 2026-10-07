"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { NUTRITION_SELECT, RIDE_TYPES, toNutritionInput } from "@/lib/nutrition-data";
import { toSessionNutrition } from "@/lib/training-engine/nutrition-analysis";

function optInt(raw: FormDataEntryValue | null, max: number, label: string): number | null {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`${label}: ingresá un valor entre 0 y ${max}`);
  return Math.round(n);
}

async function ownRide(activityId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const a = await prisma.activity.findUnique({ where: { id: activityId }, select: { id: true, athleteId: true, type: true } });
  if (!a || a.athleteId !== session.user.id) throw new Error("Actividad no encontrada");
  if (!RIDE_TYPES.includes(a.type)) throw new Error("La nutrición se registra solo en salidas de bici");
  return { athleteId: session.user.id, activityId: a.id };
}

/** Guarda lo consumido durante la sesión. Campos vacíos = sin dato (no es lo mismo que 0). */
export async function saveActivityNutrition(formData: FormData) {
  const { activityId } = await ownRide(String(formData.get("activityId")));
  const carbs = optInt(formData.get("carbsG"), 400, "Carbohidratos (g)");
  const fluid = optInt(formData.get("fluidMl"), 8000, "Líquido (ml)");
  const sodium = optInt(formData.get("sodiumMg"), 12000, "Sodio (mg)");
  const giRaw = String(formData.get("giComfort") ?? "");
  const gi = giRaw === "" ? null : Number(giRaw);
  if (gi != null && ![1, 2, 3].includes(gi)) throw new Error("Tolerancia digestiva inválida");
  const empty = carbs == null && fluid == null && sodium == null && gi == null;

  await prisma.activity.update({
    where: { id: activityId },
    data: {
      nutritionCarbsG: carbs,
      nutritionFluidMl: fluid,
      nutritionSodiumMg: sodium,
      nutritionGiComfort: gi,
      nutritionFollowedPlan: false,
      nutritionLoggedAt: empty ? null : new Date(),
    },
  });
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/dashboard");
}

/** "Consumí lo planificado": guarda los carbohidratos sugeridos para esa sesión (proporcionales a la duración real). */
export async function applyPlannedNutrition(formData: FormData) {
  const { activityId } = await ownRide(String(formData.get("activityId")));
  const row = await prisma.activity.findUnique({ where: { id: activityId }, select: NUTRITION_SELECT });
  if (!row) throw new Error("Actividad no encontrada");
  const s = toSessionNutrition(toNutritionInput(row));
  if (s.targetGPerHour <= 0) throw new Error("Para esta sesión no se sugirieron carbohidratos");

  await prisma.activity.update({
    where: { id: activityId },
    data: { nutritionCarbsG: Math.round(s.targetGPerHour * s.hours), nutritionFollowedPlan: true, nutritionLoggedAt: new Date() },
  });
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/dashboard");
}
