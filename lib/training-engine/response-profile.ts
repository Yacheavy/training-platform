import { prisma } from "@/lib/prisma";
import { classifyStimulusType } from "./stimulus-classifier";

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

  const wellness = await prisma.wellness.findMany({
  });

  const wellnessByDate = new Map(
    wellness.map((w) => [w.date.toISOString().split("T")[0], w])
  );

  // Acumuladores por tipo de estímulo
  const impacts: Record<string, number[]> = {};

  for (const activity of activities) {
    const stimulusType = classifyStimulusType(activity);
    const activityDateStr = activity.date.toISOString().split("T")[0];
    const activityDate = new Date(activityDateStr);

    // Baseline: promedio de HRV de los 7 días ANTES de la actividad
    const baselineValues: number[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(activityDate);
      d.setDate(d.getDate() - i);
      const w = wellnessByDate.get(d.toISOString().split("T")[0]);
      if (w?.hrv) baselineValues.push(w.hrv);
    }
    if (baselineValues.length < 3) continue; // sin suficiente baseline, saltamos

    const baseline =
      baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;

    // HRV del día siguiente a la actividad
    const nextDay = new Date(activityDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayWellness = wellnessByDate.get(
      nextDay.toISOString().split("T")[0]
    );
    if (!nextDayWellness?.hrv) continue;

    const pctImpact = ((nextDayWellness.hrv - baseline) / baseline) * 100;

    if (!impacts[stimulusType]) impacts[stimulusType] = [];
    impacts[stimulusType].push(pctImpact);
  }

  // Guardar/actualizar el perfil por cada tipo de estímulo encontrado
  const results: Record<string, { avgImpact: number; count: number }> = {};

  for (const [stimulusType, values] of Object.entries(impacts)) {
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