import { dayKeyDate, dayRangeLocal, weekRangeLocal } from "@/lib/tz";
import { prisma } from "@/lib/prisma";

export async function getDashboardData(athleteId: string) {
  // Nunca "mañana": Intervals proyecta CTL/ATL a fechas futuras sin HRV/FC/sueño
  const latestWellness = await prisma.wellness.findFirst({
    where: { athleteId, date: { lte: dayKeyDate(new Date()) } },
    orderBy: { date: "desc" },
  });

  // Cada métrica toma su último valor disponible (el de hoy llega recién cuando el
  // reloj sincroniza a la mañana); se informa la fecha para mostrar "de ayer", etc.
  const recent = await prisma.wellness.findMany({
    where: { athleteId, date: { lte: dayKeyDate(new Date()) } },
    orderBy: { date: "desc" },
    take: 14,
    select: { date: true, hrv: true, restingHr: true, sleepHours: true },
  });
  const hrvRow = recent.find((w) => w.hrv != null) ?? null;
  const rhrRow = recent.find((w) => w.restingHr != null) ?? null;
  const sleepRow = recent.find((w) => w.sleepHours != null) ?? null;

  // Media de los 7 días previos al dato más reciente (mínimo 4 días con dato)
  const prior = hrvRow
    ? recent.filter((w) => w.hrv != null && w.date < hrvRow.date).slice(0, 7)
    : [];
  const hrvAvg7d =
    prior.length >= 4 ? prior.reduce((a, b) => a + b.hrv!, 0) / prior.length : null;

  // Últimas 7 actividades reales, para la lista/resumen
  const recentActivities = await prisma.activity.findMany({
    where: { athleteId },
    orderBy: { date: "desc" },
    take: 7,
    select: { date: true, name: true, type: true, tss: true, durationSec: true },
  });

  return {
    ctl: latestWellness?.ctl ?? null,
    atl: latestWellness?.atl ?? null,
    tsb:
      latestWellness?.ctl != null && latestWellness?.atl != null
        ? Math.round((latestWellness.ctl - latestWellness.atl) * 10) / 10
        : null,
    hrvToday: hrvRow?.hrv ?? null,
    hrvDate: hrvRow?.date ?? null,
    hrvAvg7d: hrvAvg7d != null ? Math.round(hrvAvg7d * 10) / 10 : null,
    restingHr: rhrRow?.restingHr ?? null,
    restingHrDate: rhrRow?.date ?? null,
    sleepHours: sleepRow?.sleepHours ?? null,
    sleepDate: sleepRow?.date ?? null,
    lastWellnessDate: latestWellness?.date ?? null,
    recentActivities,
  };
}
export async function getTodayWorkout(athleteId: string) {
  const { start: startOfDay, end: endOfDay } = dayRangeLocal(new Date());

  return prisma.generatedWorkout.findFirst({
    where: { athleteId, date: { gte: startOfDay, lt: endOfDay } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLoadHistory(athleteId: string, days: number = 56) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const records = await prisma.wellness.findMany({
    where: { athleteId, date: { gte: startDate, lte: dayKeyDate(new Date()) }, ctl: { not: null } },
    orderBy: { date: "asc" },
    select: { date: true, ctl: true, atl: true },
  });

  return records.map((r) => ({
    date: r.date.toISOString(),
    ctl: r.ctl,
    atl: r.atl,
    tsb: r.ctl != null && r.atl != null ? Math.round((r.ctl - r.atl) * 10) / 10 : null,
  }));
}

export async function getWeeklyTemplate(athleteId: string) {
  const slots = await prisma.trainingTemplateSlot.findMany({
    where: { athleteId },
    orderBy: { dayOfWeek: "asc" },
  });
  return slots;
}

/**
 * Los entrenamientos REALES ya generados para la semana actual (domingo a
 * sábado), con blocksJson incluido — a diferencia de getWeeklyTemplate,
 * que solo trae la plantilla genérica (tipo de día, sin intervalos). Se
 * usa para el bloque "Semana actual" del dashboard, que muestra un mini
 * gráfico de intervalos por día como en Intervals.icu.
 */
export async function getCurrentWeekWorkouts(athleteId: string) {
  const { start: startOfWeek, end: endOfWeek } = weekRangeLocal(new Date());

  const workouts = await prisma.generatedWorkout.findMany({
    where: { athleteId, date: { gte: startOfWeek, lt: endOfWeek } },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      workoutLibraryKey: true,
      status: true,
      estimatedTss: true,
      blocksJson: true,
    },
  });

  return workouts.map((w) => ({
    ...w,
    date: w.date.toISOString(),
    blocksJson: w.blocksJson as unknown as { type: string; durationSec: number; targetWatts: number }[],
  }));
}

export async function getHrvRhrHistory(athleteId: string, days: number = 7) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const records = await prisma.wellness.findMany({
    where: { athleteId, date: { gte: startDate, lte: dayKeyDate(new Date()) } },
    orderBy: { date: "asc" },
    select: { date: true, hrv: true, restingHr: true },
  });
  return records.map((r) => ({
    date: r.date.toISOString(),
    hrv: r.hrv,
    restingHr: r.restingHr,
  }));
}

export async function getAvailabilityHistory(athleteId: string, days: number = 30) {
  const startDate = new Date(Date.now() - (days + 7) * 24 * 60 * 60 * 1000);
  const records = await prisma.wellness.findMany({
    where: { athleteId, date: { gte: startDate, lte: dayKeyDate(new Date()) } },
    orderBy: { date: "asc" },
    select: { date: true, hrv: true, ctl: true, atl: true },
  });

  const result: { date: string; score: number }[] = [];
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  for (const record of records) {
    if (record.date < cutoff) continue;

    const priorSeven = records.filter((r) => {
      const diff = (record.date.getTime() - r.date.getTime()) / (1000 * 60 * 60 * 24);
      return diff > 0 && diff <= 7 && r.hrv != null;
    });
    // Sin datos suficientes no se inventa un puntaje (antes los faltantes contaban como 0 → 70 falso)
    if (record.hrv == null || record.ctl == null || record.atl == null || priorSeven.length < 4) continue;
    const hrvAvg7d = priorSeven.reduce((s, r) => s + (r.hrv ?? 0), 0) / priorSeven.length;

    const hrvDeltaPct = hrvAvg7d > 0 ? ((record.hrv - hrvAvg7d) / hrvAvg7d) * 100 : 0;
    const tsb = record.ctl - record.atl;

    let score = 70;
    score += Math.max(-20, Math.min(20, hrvDeltaPct * 2));
    score += Math.max(-15, Math.min(15, tsb * 0.5));
    score = Math.round(Math.max(0, Math.min(100, score)));

    result.push({ date: record.date.toISOString(), score });
  }

  return result;
}
export async function getUpcomingBlocks(athleteId: string) {
  const today = new Date();
  const blocks = await prisma.trainingBlock.findMany({
    where: { athleteId, endDate: { gte: today } },
    orderBy: { startDate: "asc" },
    take: 4,
  });
  return blocks.map((b) => ({
    id: b.id,
    name: b.name,
    objective: b.objective,
    startDate: b.startDate.toISOString(),
    endDate: b.endDate.toISOString(),
  }));
}