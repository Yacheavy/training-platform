import { prisma } from "@/lib/prisma";
import { analyzeNutrition, toSessionNutrition, MIN_ELIGIBLE_SEC, type NutritionActivityInput, type NutritionSummary } from "@/lib/training-engine/nutrition-analysis";

export const RIDE_TYPES = ["Ride", "VirtualRide", "GravelRide", "MountainBikeRide", "EBikeRide"];

type ActivityRow = {
  id: string;
  date: Date;
  name: string | null;
  durationSec: number;
  tss: number | null;
  plannedTss: number | null;
  intensityFactor: number | null;
  decouplingPct: number | null;
  efficiencyFactor: number | null;
  nutritionCarbsG: number | null;
  intervalsCarbsG: number | null;
  nutritionFluidMl: number | null;
  nutritionSodiumMg: number | null;
  nutritionGiComfort: number | null;
  generatedWorkout: { suggestedCarbsGPerHour: number | null } | null;
};

/** Las actividades guardan la hora local como si fuera UTC: el día sale de toISOString(). */
export function toNutritionInput(a: ActivityRow): NutritionActivityInput {
  return {
    id: a.id,
    dateKey: a.date.toISOString().slice(0, 10),
    name: a.name,
    durationSec: a.durationSec,
    tss: a.tss,
    plannedTss: a.plannedTss,
    intensityFactor: a.intensityFactor,
    decouplingPct: a.decouplingPct,
    efficiencyFactor: a.efficiencyFactor,
    plannedCarbsPerHour: a.generatedWorkout?.suggestedCarbsGPerHour ?? null,
    // el registro manual tiene prioridad sobre lo que traiga Intervals
    carbsG: a.nutritionCarbsG ?? (a.intervalsCarbsG != null ? Math.round(a.intervalsCarbsG) : null),
    fluidMl: a.nutritionFluidMl,
    sodiumMg: a.nutritionSodiumMg,
    giComfort: a.nutritionGiComfort,
  };
}

export const NUTRITION_SELECT = {
  id: true, date: true, name: true, durationSec: true, tss: true, plannedTss: true, intensityFactor: true,
  decouplingPct: true, efficiencyFactor: true, nutritionCarbsG: true, intervalsCarbsG: true,
  nutritionFluidMl: true, nutritionSodiumMg: true, nutritionGiComfort: true,
  generatedWorkout: { select: { suggestedCarbsGPerHour: true } },
} as const;

export async function getNutritionSummary(athleteId: string, days = 42): Promise<NutritionSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.activity.findMany({
    where: { athleteId, date: { gte: since }, type: { in: RIDE_TYPES }, durationSec: { gte: 20 * 60 } },
    select: NUTRITION_SELECT,
    orderBy: { date: "asc" },
  });
  return analyzeNutrition(rows.map(toNutritionInput), days);
}

export interface PendingNutrition {
  id: string;
  dateKey: string;
  name: string | null;
  durationSec: number;
  plannedG: number; // 0 = no se sugirieron carbohidratos
}

/** Salidas de bici recientes (≥ 1 h, últimos 7 días) cuya nutrición todavía no se registró ni se omitió. */
export async function getPendingNutrition(athleteId: string): Promise<PendingNutrition[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.activity.findMany({
    where: {
      athleteId, date: { gte: since }, type: { in: RIDE_TYPES }, durationSec: { gte: MIN_ELIGIBLE_SEC },
      nutritionLoggedAt: null, nutritionCarbsG: null, intervalsCarbsG: null,
    },
    select: NUTRITION_SELECT,
    orderBy: { date: "desc" },
    take: 3,
  });
  return rows.map((r) => {
    const s = toSessionNutrition(toNutritionInput(r));
    return { id: r.id, dateKey: r.date.toISOString().slice(0, 10), name: r.name, durationSec: r.durationSec, plannedG: Math.round(s.targetGPerHour * s.hours) };
  });
}

export interface PendingPostRide {
  id: string;
  name: string | null;
  dateLabel: string;
  minutes: number;
  tss: number | null;
  hours: number;
  targetGPerHour: number;
  plannedG: number;
  needsNutrition: boolean;
  needsRating: boolean;
}

/**
 * La salida de bici de las últimas 48 h a la que le falta nutrición y/o RPE y sensación (y no se omitió el popup).
 * Si el atleta ya cargó RPE o sensación (acá o en Intervals) no se le vuelve a pedir la percepción.
 */
export async function getPendingPostRide(athleteId: string): Promise<PendingPostRide | null> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const rows = await prisma.activity.findMany({
    where: { athleteId, date: { gte: since }, type: { in: RIDE_TYPES }, durationSec: { gte: 30 * 60 }, postRideDoneAt: null },
    select: { ...NUTRITION_SELECT, nutritionLoggedAt: true, rpe: true, feel: true },
    orderBy: { date: "desc" },
    take: 5,
  });
  for (const r of rows) {
    const needsNutrition = r.durationSec >= MIN_ELIGIBLE_SEC && r.nutritionLoggedAt == null && r.nutritionCarbsG == null && r.intervalsCarbsG == null;
    const needsRating = r.rpe == null && r.feel == null;
    if (!needsNutrition && !needsRating) continue;
    const s = toSessionNutrition(toNutritionInput(r));
    return {
      id: r.id,
      name: r.name,
      dateLabel: r.date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
      minutes: Math.round(r.durationSec / 60),
      tss: r.tss,
      hours: s.hours,
      targetGPerHour: s.targetGPerHour,
      plannedG: Math.round(s.targetGPerHour * s.hours),
      needsNutrition,
      needsRating,
    };
  }
  return null;
}
