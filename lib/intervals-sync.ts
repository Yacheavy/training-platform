import { prisma } from "@/lib/prisma";
import { getActivities, getWellness } from "@/lib/intervals-client";
import { dateKeyLocal } from "@/lib/tz";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapActivity(a: any, userId: string) {
  return {
    athleteId: userId,
    intervalsActivityId: String(a.id),
    date: new Date(a.start_date_local),
    type: a.type ?? "Unknown",
    name: a.name ?? null,
    durationSec: a.moving_time ?? 0,
    distanceM: a.icu_distance,
    avgPower: a.icu_average_watts,
    normalizedPower: a.icu_weighted_avg_watts,
    avgHr: a.average_heartrate,
    maxHr: a.max_heartrate,
    avgCadence: a.average_cadence,
    kilojoules: a.icu_joules,
    tss: a.icu_training_load,
    intensityFactor: a.icu_intensity,
    elevationGainM: a.total_elevation_gain,
    powerBalanceLeft: a.avg_lr_balance,
    decouplingPct: a.decoupling,
    hrLoad: a.hr_load,
    trimp: a.trimp,
    efficiencyFactor: a.icu_efficiency_factor,
    variabilityIndex: a.icu_variability_index,
    polarizationIndex: a.polarization_index,
    hrrValue: a.icu_hrr?.hrr ?? null,
    rawStreamsJson: a.icu_zone_times ? { zoneTimes: a.icu_zone_times } : undefined,
  };
}

export function mapWellness(w: any, userId: string) {
  return {
    athleteId: userId,
    date: new Date(w.id), // en wellness, Intervals usa "id" como la fecha (YYYY-MM-DD)
    hrv: w.hrv,
    restingHr: w.restingHR,
    sleepScore: w.sleepScore,
    sleepHours: w.sleepSecs ? w.sleepSecs / 3600 : null,
    steps: w.steps,
    spo2: w.spO2,
    stressScore: w.stress,
    ctl: w.ctl,
    atl: w.atl,
    rampRate: w.rampRate,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SyncResult {
  activities: number;
  wellness: number;
  errors: string[];
}

/**
 * Sincronización INCREMENTAL con Intervals.icu: trae los últimos `days` días
 * (por defecto 14: cubre ediciones tardías y días sin abrir la app) y hace upsert.
 * Las rutas de historial completo siguen existiendo para cargas iniciales.
 */
export async function syncIntervals(userId: string, days = 14): Promise<SyncResult> {
  const apiKey = process.env.INTERVALS_API_KEY_DEV;
  const athleteId = process.env.INTERVALS_ATHLETE_ID_DEV;
  const result: SyncResult = { activities: 0, wellness: 0, errors: [] };
  if (!apiKey || !athleteId) {
    result.errors.push("Faltan credenciales de Intervals (INTERVALS_API_KEY_DEV / INTERVALS_ATHLETE_ID_DEV)");
    return result;
  }

  const now = new Date();
  const oldest = dateKeyLocal(new Date(now.getTime() - days * DAY_MS));
  const newest = dateKeyLocal(new Date(now.getTime() + DAY_MS));

  try {
    const activities = await getActivities(athleteId, apiKey, oldest, newest);
    for (const a of activities as any[]) {
      try {
        const mapped = mapActivity(a, userId);
        await prisma.activity.upsert({ where: { intervalsActivityId: mapped.intervalsActivityId }, update: mapped, create: mapped });
        result.activities++;
      } catch (err) {
        result.errors.push(`Activity ${a?.id}: ${String(err)}`);
      }
    }
  } catch (err) {
    result.errors.push(`Actividades ${oldest}→${newest}: ${String(err)}`);
  }

  try {
    const wellness = await getWellness(athleteId, apiKey, oldest, newest);
    for (const w of wellness as any[]) {
      try {
        const mapped = mapWellness(w, userId);
        await prisma.wellness.upsert({ where: { date: mapped.date }, update: mapped, create: mapped });
        result.wellness++;
      } catch (err) {
        result.errors.push(`Wellness ${w?.id}: ${String(err)}`);
      }
    }
  } catch (err) {
    result.errors.push(`Wellness ${oldest}→${newest}: ${String(err)}`);
  }

  // Solo marcamos la sync como hecha si al menos una de las dos llamadas funcionó
  if (result.activities > 0 || result.wellness > 0 || result.errors.length === 0) {
    await prisma.user.update({ where: { id: userId }, data: { intervalsLastSyncAt: new Date() } });
  }
  return result;
}

/** Sincroniza si la última sync tiene más de `maxAgeMin` minutos. Nunca lanza ni bloquea más de `timeoutMs`. */
export async function syncIfStale(userId: string, maxAgeMin = 20, timeoutMs = 9000): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { intervalsLastSyncAt: true } });
    const last = user?.intervalsLastSyncAt?.getTime() ?? 0;
    if (Date.now() - last < maxAgeMin * 60 * 1000) return;
    await Promise.race([syncIntervals(userId), new Promise((r) => setTimeout(r, timeoutMs))]);
  } catch (err) {
    console.error("syncIfStale falló:", err);
  }
}
