import { prisma } from "@/lib/prisma";
import { dayKeyDate, weekRangeLocal, dateKeyLocal, dayOfWeekLocal } from "@/lib/tz";
import { calculateAvailability } from "@/lib/training-engine/availability";
import { MIN_BASELINE_DAYS, MIN_ROLLING_DAYS } from "@/lib/training-engine/recovery-signals";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const RIDE_TYPES = ["Ride", "VirtualRide", "MountainBikeRide", "GravelRide"];

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

export interface HrvBandData {
  points: { date: string; hrv: number | null; restingHr: number | null; roll7: number | null }[];
  /** Banda de la línea base individual (LnRMSSD ± 0,5 DE, convertida a ms). null si faltan datos. */
  band: { low: number; high: number; mean: number; days: number } | null;
}

/** HRV de los últimos `days` días con media móvil de 7 días y la banda de tu línea base de 60 días (Plews 2013). */
export async function getHrvBandData(athleteId: string, days = 30): Promise<HrvBandData> {
  const today = dayKeyDate(new Date());
  const rows = await prisma.wellness.findMany({
    where: { athleteId, date: { gte: new Date(today.getTime() - (days + 70) * DAY_MS), lte: today } },
    orderBy: { date: "asc" },
    select: { date: true, hrv: true, restingHr: true },
  });
  const byTime = new Map(rows.map((r) => [r.date.getTime(), r]));

  // Línea base: 60 días previos a hoy (sin hoy)
  const base = rows
    .filter((r) => r.hrv && r.hrv > 0 && r.date.getTime() < today.getTime() && r.date.getTime() >= today.getTime() - 60 * DAY_MS)
    .map((r) => Math.log(r.hrv!));
  let band: HrvBandData["band"] = null;
  if (base.length >= MIN_BASELINE_DAYS) {
    const m = mean(base);
    const s = sd(base);
    band = { low: Math.exp(m - 0.5 * s), high: Math.exp(m + 0.5 * s), mean: Math.exp(m), days: base.length };
  }

  const points: HrvBandData["points"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = today.getTime() - i * DAY_MS;
    const row = byTime.get(t);
    const window: number[] = [];
    for (let k = 0; k < 7; k++) {
      const v = byTime.get(t - k * DAY_MS)?.hrv;
      if (v && v > 0) window.push(Math.log(v));
    }
    points.push({
      date: new Date(t).toISOString(),
      hrv: row?.hrv ?? null,
      restingHr: row?.restingHr ?? null,
      roll7: window.length >= MIN_ROLLING_DAYS ? Math.exp(mean(window)) : null,
    });
  }
  return { points, band };
}

export interface WeeklyIntensity {
  weekStart: string;
  lowH: number; // Z1–Z2
  midH: number; // Z3–Z4
  highH: number; // Z5–Z7
  totalH: number;
}

/**
 * Distribución de intensidad por semana (modelo de 3 zonas de Seiler sobre las zonas de potencia de Intervals):
 * baja = Z1–Z2, media = Z3–Z4, alta = Z5–Z7. El "sweet spot" (SS) se ignora: se solapa con Z3/Z4 y duplicaría tiempo.
 */
export async function getWeeklyIntensity(athleteId: string, weeks = 10): Promise<WeeklyIntensity[]> {
  const currentStart = weekRangeLocal(new Date()).start.getTime();
  const from = new Date(currentStart - (weeks - 1) * WEEK_MS);
  const acts = await prisma.activity.findMany({
    where: { athleteId, type: { in: RIDE_TYPES }, date: { gte: from } },
    select: { date: true, rawStreamsJson: true },
  });

  const buckets: WeeklyIntensity[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(currentStart - (weeks - 1 - i) * WEEK_MS).toISOString(),
    lowH: 0, midH: 0, highH: 0, totalH: 0,
  }));

  for (const a of acts) {
    const zt = (a.rawStreamsJson as { zoneTimes?: { id: string; secs: number }[] } | null)?.zoneTimes;
    if (!zt?.length) continue;
    const idx = Math.floor((weekRangeLocal(a.date).start.getTime() - (currentStart - (weeks - 1) * WEEK_MS)) / WEEK_MS);
    const b = buckets[idx];
    if (!b) continue;
    const s = (ids: string[]) => zt.filter((z) => ids.includes(z.id)).reduce((t, z) => t + z.secs, 0) / 3600;
    b.lowH += s(["Z1", "Z2"]);
    b.midH += s(["Z3", "Z4"]);
    b.highH += s(["Z5", "Z6", "Z7"]);
  }
  for (const b of buckets) b.totalH = b.lowH + b.midH + b.highH;
  return buckets;
}

export interface WeekPlanVsActual {
  weekStart: string;
  isCurrent: boolean;
  plannedMin: number;
  plannedTss: number;
  actualMin: number;
  actualTss: number;
  /** Realizado / planificado (hasta hoy en la semana actual). null si no había plan. */
  compliancePct: number | null;
}

const sumBlocks = (b: unknown) => ((b as { durationSec?: number }[]) ?? []).reduce((s, x) => s + (x.durationSec ?? 0), 0) / 60;

/** Planificado vs. realizado por semana (solo ciclismo). */
export async function getPlanVsActual(athleteId: string, weeks = 10): Promise<WeekPlanVsActual[]> {
  const now = new Date();
  const currentStart = weekRangeLocal(now).start.getTime();
  const firstStart = currentStart - (weeks - 1) * WEEK_MS;
  const from = new Date(firstStart);
  const to = new Date(currentStart + WEEK_MS);

  const [planned, slots, acts] = await Promise.all([
    prisma.generatedWorkout.findMany({
      where: { athleteId, date: { gte: from, lt: to }, workoutLibraryKey: { not: "gym" } },
      select: { date: true, estimatedTss: true, blocksJson: true, status: true },
    }),
    prisma.trainingTemplateSlot.findMany({ where: { athleteId }, select: { dayOfWeek: true } }),
    prisma.activity.findMany({
      where: { athleteId, type: { in: RIDE_TYPES }, date: { gte: from, lt: to } },
      select: { date: true, tss: true, durationSec: true },
    }),
  ]);

  const out: WeekPlanVsActual[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(firstStart + i * WEEK_MS).toISOString(),
    isCurrent: i === weeks - 1,
    plannedMin: 0, plannedTss: 0, actualMin: 0, actualTss: 0, compliancePct: null,
  }));
  const todayKey = dateKeyLocal(now);
  const idxOf = (d: Date) => Math.floor((weekRangeLocal(d).start.getTime() - firstStart) / WEEK_MS);

  // Lo planificado que todavía no pasó (semana actual) no cuenta para el cumplimiento
  const plannedToDate = new Array(weeks).fill(0).map(() => ({ tss: 0, min: 0 }));
  for (const p of planned) {
    const w = out[idxOf(p.date)];
    if (!w) continue;
    const min = sumBlocks(p.blocksJson);
    w.plannedMin += min;
    w.plannedTss += p.estimatedTss ?? 0;
    // "Vencida" = un día anterior a hoy (hora local) o una sesión ya completada; la de hoy sin hacer todavía no cuenta
    if (dateKeyLocal(p.date) < todayKey || p.status === "COMPLETED") {
      plannedToDate[idxOf(p.date)].tss += p.estimatedTss ?? 0;
      plannedToDate[idxOf(p.date)].min += min;
    }
  }
  for (const a of acts) {
    const w = out[idxOf(a.date)];
    if (!w) continue;
    w.actualMin += a.durationSec / 60;
    w.actualTss += a.tss ?? 0;
  }
  // La primera semana del plan suele estar incompleta (se generó a mitad de semana): no sirve para medir cumplimiento
  const firstPlanned = planned.length ? planned.reduce((m, p) => (p.date < m ? p.date : m), planned[0].date) : null;
  const firstWeekIdx = firstPlanned ? idxOf(firstPlanned) : -1;
  // Semana incompleta = faltan sesiones que la plantilla pone ANTES del primer día planificado
  // (si la plantilla simplemente descansa esos días, la semana está completa)
  const templateDays = new Set(slots.map((x) => x.dayOfWeek));
  const startsMidWeek = firstPlanned
    ? Array.from({ length: dayOfWeekLocal(firstPlanned) }, (_, d) => d).some((d) => templateDays.has(d))
    : false;
  out.forEach((w, i) => {
    const refTss = i === firstWeekIdx && startsMidWeek ? 0 : plannedToDate[i].tss;
    w.compliancePct = refTss > 0 ? Math.round((w.actualTss / refTss) * 100) : null;
    w.plannedMin = Math.round(w.plannedMin);
    w.plannedTss = Math.round(w.plannedTss);
    w.actualMin = Math.round(w.actualMin);
    w.actualTss = Math.round(w.actualTss);
  });
  return out;
}

export interface StudentRow {
  id: string;
  name: string;
  email: string;
  status: "GREEN" | "AMBER" | "RED" | null;
  reasons: string[];
  hrvAgeDays: number | null;
  tsb: number | null;
  ctl: number | null;
  lastActivity: string | null;
  lastSync: string | null;
  weekActualTss: number;
  weekPlannedToDateTss: number;
  hasIntervals: boolean;
}

/** Resumen de todos los alumnos invitados por el entrenador (sin incluirlo a él). */
export async function getCoachOverview(coachId: string): Promise<StudentRow[]> {
  const invites = await prisma.allowedEmail.findMany({ where: { OR: [{ invitedById: coachId }, { invitedById: null }] }, select: { email: true } });
  const students = await prisma.user.findMany({
    where: { email: { in: invites.map((i) => i.email) }, role: { not: "COACH" }, id: { not: coachId } },
    select: { id: true, name: true, email: true, intervalsLastSyncAt: true, intervalsAthleteId: true },
    orderBy: { name: "asc" },
  });

  const week = weekRangeLocal(new Date());
  const now = new Date();

  return Promise.all(
    students.map(async (s) => {
      const [avail, lastAct, latest, planned, acts] = await Promise.all([
        calculateAvailability(s.id).catch(() => null),
        prisma.activity.findFirst({ where: { athleteId: s.id }, orderBy: { date: "desc" }, select: { date: true } }),
        prisma.wellness.findFirst({ where: { athleteId: s.id, date: { lte: dayKeyDate(now) }, ctl: { not: null } }, orderBy: { date: "desc" }, select: { ctl: true } }),
        prisma.generatedWorkout.findMany({ where: { athleteId: s.id, date: { gte: week.start, lt: now }, workoutLibraryKey: { not: "gym" } }, select: { estimatedTss: true } }),
        prisma.activity.findMany({ where: { athleteId: s.id, type: { in: RIDE_TYPES }, date: { gte: week.start, lt: week.end } }, select: { tss: true } }),
      ]);
      return {
        id: s.id,
        name: s.name ?? s.email.split("@")[0],
        email: s.email,
        status: avail?.status ?? null,
        reasons: avail?.reasons ?? [],
        hrvAgeDays: avail?.wellnessAgeDays ?? null,
        tsb: avail?.tsb != null ? Math.round(avail.tsb * 10) / 10 : null,
        ctl: latest?.ctl != null ? Math.round(latest.ctl * 10) / 10 : null,
        lastActivity: lastAct?.date.toISOString() ?? null,
        lastSync: s.intervalsLastSyncAt?.toISOString() ?? null,
        weekActualTss: Math.round(acts.reduce((t, a) => t + (a.tss ?? 0), 0)),
        weekPlannedToDateTss: Math.round(planned.reduce((t, p) => t + (p.estimatedTss ?? 0), 0)),
        hasIntervals: !!s.intervalsAthleteId,
      } satisfies StudentRow;
    })
  );
}
