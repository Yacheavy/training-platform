import { WorkoutBlock, calculateKilojoules } from "./tss";

export interface FuelingResult {
  totalKj: number;
  suggestedCarbsG: number;
  suggestedCarbsGPerHour: number;
  requiresMultipleCarbSources: boolean;
}

/** g/h objetivo según duración e intensidad (misma tabla que calculateFueling). */
export function carbTargetGPerHour(hours: number, intense: boolean): number {
  let gPerHour: number;
  if (hours < 0.75) gPerHour = 0;
  else if (hours < 1) gPerHour = intense ? 15 : 0;
  else if (hours < 2) gPerHour = intense ? 50 : 30;
  else if (hours < 2.5) gPerHour = 60;
  else if (hours <= 3) gPerHour = intense ? 75 : 60;
  else gPerHour = intense ? 90 : 75;
  return Math.min(90, gPerHour);
}

/**
 * Carbohidratos intra-entrenamiento según duración e intensidad
 * (Jeukendrup 2014; ACSM/AND/DC 2016):
 *   < 45 min            → 0 g/h (enjuague bucal opcional)
 *   45–75 min           → ~15 g/h solo si la sesión es intensa
 *   1–2 h               → 30 g/h (45–60 si es intensa)
 *   2–2.5 h             → 60 g/h
 *   2.5–3 h             → 60–75 g/h
 *   > 3 h               → hasta 90 g/h
 * Tope 90 g/h. Más de ~60 g/h requiere mezcla glucosa:fructosa
 * (transportadores múltiples), no una sola fuente.
 *
 * `ftp` es opcional: si se pasa, la intensidad se infiere por la potencia
 * media ponderada (≥ 80% FTP o bloques ≥ 95% FTP = sesión intensa).
 * Sin `ftp`, se usa la intensidad como desconocida (se asume moderada).
 */
export function calculateFueling(blocks: WorkoutBlock[], ftp?: number): FuelingResult {
  const totalKj = calculateKilojoules(blocks);
  const totalSec = blocks.reduce((sum, b) => sum + b.durationSec, 0);
  const hours = totalSec / 3600;

  let intense = false;
  if (ftp && ftp > 0 && totalSec > 0) {
    const avg = blocks.reduce((s, b) => s + b.targetWatts * b.durationSec, 0) / totalSec;
    const hardSec = blocks
      .filter((b) => b.targetWatts >= ftp * 0.95)
      .reduce((s, b) => s + b.durationSec, 0);
    intense = avg >= ftp * 0.8 || hardSec >= 600;
  }

  const gPerHour = carbTargetGPerHour(hours, intense);

  return {
    totalKj,
    suggestedCarbsG: Math.round(gPerHour * hours),
    suggestedCarbsGPerHour: gPerHour,
    requiresMultipleCarbSources: gPerHour > 60,
  };
}
