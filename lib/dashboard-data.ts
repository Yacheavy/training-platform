import { dayKeyDate, dayRangeLocal, weekRangeLocal } from "@/lib/tz";
import { prisma } from "@/lib/prisma";

export async function getDashboardData(athleteId: string) {
  // Nunca "mañana": Intervals proyecta CTL/ATL a fechas futuras sin HRV/FC/sueño
  const latestWellness = await prisma.wellness.findFirst({
    where: { athleteId, date: { lte: dayKeyDate(new Date()) } },
    orderBy: { date: "desc" },
  });

  // Media de HRV de los últimos 7 días, para comparar contra hoy
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentWellness = await prisma.wellness.findMany({
    where: { athleteId, date: { gte: sevenDaysAgo }, hrv: { not: null } },
    select: { hrv: true },
  });
  const hrvValues = recentWellness.map((w) => w.hrv!).filter(Boolean);
  const hrvAvg7d =
    hrvValues.length > 0 ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length : null;

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
    hrvToday: latestWellness?.hrv ?? null,
    hrvAvg7d: hrvAvg7d != null ? Math.round(hrvAvg7d * 10) / 10 : null,
    restingHr: latestWellness?.restingHr ?? null,
    sleepHours: latestWellness?.sleepHours ?? null,
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
    const hrvAvg7d =
      priorSeven.length > 0 ? priorSeven.reduce((s, r) => s + (r.hrv ?? 0), 0) / priorSeven.length : null;

    const hrvDeltaPct =
      record.hrv != null && hrvAvg7d != null && hrvAvg7d > 0 ? ((record.hrv - hrvAvg7d) / hrvAvg7d) * 100 : 0;
    const tsb = record.ctl != null && record.atl != null ? record.ctl - record.atl : 0;

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