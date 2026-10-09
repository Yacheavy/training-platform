import { prisma } from "@/lib/prisma";
import { classifyStimulusType } from "./stimulus-classifier";
import { dateKeyLocal } from "@/lib/tz";

/** Mínimo de sesiones para guardar un perfil: con menos, el promedio es ruido (criterio propio). */
export const MIN_SESSIONS_FOR_PROFILE = 8;

/**
 * Cambio mínimo "distinguible del ruido" de la HRV de este atleta, en %: 0,5 × el desvío del ln(HRV) diario de los últimos 90 días
 * (el mismo criterio que usa el semáforo para su línea base). Criterio de diseño: no hay una fuente que valide este umbral para el perfil.
 */
export function hrvNoiseThresholdPct(lnValues: number[]): number | null {
  if (lnValues.length < 14) return null;
  const m = lnValues.reduce((a, b) => a + b, 0) / lnValues.length;
  const sd = Math.sqrt(lnValues.reduce((a, b) => a + (b - m) ** 2, 0) / (lnValues.length - 1));
  return (Math.exp(0.5 * sd) - 1) * 100;
}

/** Un promedio se publica solo con suficientes sesiones y si supera el ruido propio del atleta. */
export function isReportableImpact(values: number[], noisePct: number | null): boolean {
  if (values.length < MIN_SESSIONS_FOR_PROFILE || noisePct == null) return false;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.abs(avg) >= noisePct;
}
const DAY_MS = 86400000;
/** Suma/resta días a una clave YYYY-MM-DD sin depender de la zona horaria del servidor. */
const shiftKey = (key: string, days: number) =>
  new Date(new Date(key + "T00:00:00Z").getTime() + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Recorre TODO el historial del atleta y calcula, por tipo de estímulo,
 * el impacto promedio en HRV al día siguiente. Se puede correr las veces
 * que haga falta — recalcula desde cero cada vez (no incremental todavía,
 * eso es una optimización para más adelante si el historial crece mucho).
 */
export async function updateAthleteResponseProfile(athleteId: string) {
  const activities = await prisma.activity.findMany({
    where: { athleteId, type: { in: ["Ride", "WeightTraining"] } },
    orderBy: { date: "asc" },
  });

  const rawCounts: Record<string, number> = {};
  for (const a of activities) {
    const st = classifyStimulusType(a);
    rawCounts[st] = (rawCounts[st] ?? 0) + 1;
  }

  const wellness = await prisma.wellness.findMany({ where: { athleteId } });

  const wellnessByDate = new Map(
    wellness.map((w) => [w.date.toISOString().split("T")[0], w])
  );

  // Acumuladores por tipo de estímulo
  const impacts: Record<string, number[]> = {};

  for (const activity of activities) {
    const stimulusType = classifyStimulusType(activity);
    // Día LOCAL del atleta (una salida a la noche no debe caer en el día UTC siguiente)
    const activityDateStr = dateKeyLocal(activity.date);

    // Baseline: media de LnRMSSD de los 7 días ANTES de la actividad (mín. 4 días con dato)
    const baselineValues: number[] = [];
    for (let i = 1; i <= 7; i++) {
      const w = wellnessByDate.get(shiftKey(activityDateStr, -i));
      if (w?.hrv && w.hrv > 0) baselineValues.push(Math.log(w.hrv));
    }
    if (baselineValues.length < 4) continue; // sin suficiente baseline, saltamos

    const baseline = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;

    // HRV del día siguiente a la actividad
    const nextDayWellness = wellnessByDate.get(shiftKey(activityDateStr, 1));
    if (!nextDayWellness?.hrv || nextDayWellness.hrv <= 0) continue;

    // Impacto en % sobre la escala natural (exp de la diferencia de ln = cociente de HRV)
    const pctImpact = (Math.exp(Math.log(nextDayWellness.hrv) - baseline) - 1) * 100;

    if (!impacts[stimulusType]) impacts[stimulusType] = [];
    impacts[stimulusType].push(pctImpact);
  }

  // Ruido propio: variabilidad diaria del ln(HRV) en los últimos 90 días
  const cutoff = Date.now() - 90 * DAY_MS;
  const lnRecent = wellness.filter((w) => w.date.getTime() >= cutoff && w.hrv && w.hrv > 0).map((w) => Math.log(w.hrv as number));
  const noisePct = hrvNoiseThresholdPct(lnRecent);

  // Guardar/actualizar el perfil por cada tipo de estímulo encontrado
  const results: Record<string, { avgImpact: number; count: number }> = {};

  for (const [stimulusType, values] of Object.entries(impacts)) {
    if (!isReportableImpact(values, noisePct)) {
      // Muestra insuficiente o efecto dentro del ruido: no se publica un promedio engañoso (y se borra uno viejo)
      await prisma.athleteResponseProfile.deleteMany({ where: { athleteId, stimulusType } });
      continue;
    }
    const avgImpact = values.reduce((a, b) => a + b, 0) / values.length;

    await prisma.athleteResponseProfile.upsert({
      where: { athleteId_stimulusType: { athleteId, stimulusType } },
      update: {
        avgHrvImpactNextDayPct: avgImpact,
        sessionsCount: values.length,
      },
      create: {
        athleteId,
        stimulusType,
        avgHrvImpactNextDayPct: avgImpact,
        sessionsCount: values.length,
      },
    });

    results[stimulusType] = { avgImpact: Math.round(avgImpact * 10) / 10, count: values.length };
  }

    return { rawCounts, results };
}