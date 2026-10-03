import { WorkoutBlock, calculateKilojoules } from "./tss";

export interface FuelingResult {
  totalKj: number;
  suggestedCarbsG: number;
  suggestedCarbsGPerHour: number;
  requiresMultipleCarbSources: boolean;
}

/**
 * Método: carbohidrato = 40-50% del gasto en kJ (convertido a kcal).
 * Usamos el punto medio (45%) como estimación central.
 * Cruzamos contra el techo ACSM de absorción por hora según duración total.
 */
export function calculateFueling(blocks: WorkoutBlock[]): FuelingResult {
  const totalKj = calculateKilojoules(blocks);
  const totalDurationHours =
    blocks.reduce((sum, b) => sum + b.durationSec, 0) / 3600;

  const carbKcal = totalKj * 0.45;
  const suggestedCarbsG = Math.round(carbKcal / 4); // 4 kcal por gramo de carbohidrato

  const suggestedCarbsGPerHour =
    totalDurationHours > 0 ? Math.round(suggestedCarbsG / totalDurationHours) : 0;

  // Techo ACSM: 60g/h para sesiones de 1-2.5h, hasta 90g/h para sesiones más largas
  const hourlyThreshold = totalDurationHours > 2.5 ? 90 : 60;
  const requiresMultipleCarbSources = suggestedCarbsGPerHour > hourlyThreshold;

  return {
    totalKj,
    suggestedCarbsG,
    suggestedCarbsGPerHour,
    requiresMultipleCarbSources,
  };
}