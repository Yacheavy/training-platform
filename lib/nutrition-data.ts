import { prisma } from "@/lib/prisma";
import { analyzeNutrition, type NutritionActivityInput, type NutritionSummary } from "@/lib/training-engine/nutrition-analysis";

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
