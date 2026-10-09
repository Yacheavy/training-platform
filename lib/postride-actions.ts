"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sendActivityAnalysis } from "@/lib/email/activity-analysis";
import { NUTRITION_SELECT, RIDE_TYPES, toNutritionInput } from "@/lib/nutrition-data";
import { toSessionNutrition, MIN_ELIGIBLE_SEC } from "@/lib/training-engine/nutrition-analysis";
import { getIntervalsCreds } from "@/lib/intervals-creds";
import { updateActivityRatings } from "@/lib/intervals-client";
import { validFeel, validRpe } from "@/lib/ratings";

function optInt(raw: FormDataEntryValue | null, max: number, label: string): number | null {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`${label}: ingresá un valor entre 0 y ${max}`);
  return Math.round(n);
}
function optRating(raw: FormDataEntryValue | null, ok: (v: unknown) => boolean, label: string): number | null {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  if (!ok(n)) throw new Error(`${label} inválido`);
  return n;
}

/**
 * Popup posterior a la salida (y tarjeta de la sesión): guarda RPE y sensación, la alimentación y avisa a Intervals.
 * intent: "save" (guardar lo cargado), "planned" (consumí lo planificado), "skip" (no cargar nada) o "rating" (solo RPE/sensación, desde la sesión).
 * Devuelve { error } con un mensaje legible: en producción un error lanzado llegaría sin texto.
 */
export async function savePostRide(formData: FormData): Promise<{ error: string } | void> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { error: "No autenticado" };
    const a = await prisma.activity.findUnique({
      where: { id: String(formData.get("activityId") ?? "") },
      select: { ...NUTRITION_SELECT, athleteId: true, type: true, intervalsActivityId: true, nutritionLoggedAt: true },
    });
    if (!a || a.athleteId !== session.user.id) return { error: "Actividad no encontrada" };
    if (!RIDE_TYPES.includes(a.type)) return { error: "Esto se registra solo en salidas de bici" };

    const intent = String(formData.get("intent") ?? "save");
    const rpe = optRating(formData.get("rpe"), validRpe, "RPE");
    const feel = optRating(formData.get("feel"), validFeel, "Sensación");
    const hasNutritionSection = formData.get("nutrition") === "1";
    const needsNutrition = a.durationSec >= MIN_ELIGIBLE_SEC && a.nutritionLoggedAt == null && a.nutritionCarbsG == null && a.intervalsCarbsG == null;

    const data: Record<string, unknown> = {};
    if (rpe != null) data.rpe = rpe;
    if (feel != null) data.feel = feel;
    if (intent !== "rating") data.postRideDoneAt = new Date();

    if (intent !== "rating" && hasNutritionSection) {
      const carbs = optInt(formData.get("carbsG"), 400, "Carbohidratos (g)");
      const fluid = optInt(formData.get("fluidMl"), 8000, "Líquido (ml)");
      const sodium = optInt(formData.get("sodiumMg"), 12000, "Sodio (mg)");
      const giRaw = String(formData.get("giComfort") ?? "");
      const gi = giRaw === "" ? null : Number(giRaw);
      if (gi != null && ![1, 2, 3].includes(gi)) return { error: "Tolerancia digestiva inválida" };
      const anyNutrition = carbs != null || fluid != null || sodium != null || gi != null;
      if (intent === "planned") {
        const s = toSessionNutrition(toNutritionInput(a));
        if (s.targetGPerHour <= 0) return { error: "Para esta sesión no se sugirieron carbohidratos" };
        Object.assign(data, { nutritionCarbsG: Math.round(s.targetGPerHour * s.hours), nutritionFollowedPlan: true, nutritionLoggedAt: new Date() });
        if (fluid != null) data.nutritionFluidMl = fluid;
        if (sodium != null) data.nutritionSodiumMg = sodium;
        if (gi != null) data.nutritionGiComfort = gi;
      } else if (intent === "save" && anyNutrition) {
        Object.assign(data, { nutritionCarbsG: carbs, nutritionFluidMl: fluid, nutritionSodiumMg: sodium, nutritionGiComfort: gi, nutritionFollowedPlan: false, nutritionLoggedAt: new Date() });
      } else if (needsNutrition) {
        // "Omitir", o guardar sin datos de alimentación: queda como "sin dato" y no se vuelve a preguntar
        data.nutritionLoggedAt = new Date();
      }
    }
    if (Object.keys(data).length === 0) return { error: "Elegí al menos un dato para guardar." };

    await prisma.activity.update({ where: { id: a.id }, data });
    revalidatePath("/", "layout");
    after(() => sendActivityAnalysis(a.id));

    if (rpe != null || feel != null) {
      const creds = await getIntervalsCreds(a.athleteId);
      if (creds) {
        const r = await updateActivityRatings(creds.apiKey, a.intervalsActivityId, { rpe, feel }).catch((e) => ({ ok: false as const, reason: String(e) }));
        if (!r.ok) {
          console.error("No se pudo enviar RPE/sensación a Intervals", a.id, r.reason);
          return { error: "Se guardó en la app, pero no pude enviar el RPE y la sensación a Intervals. Podés cargarlos allá a mano." };
        }
      }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}
