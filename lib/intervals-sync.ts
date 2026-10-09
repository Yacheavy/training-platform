import { prisma } from "@/lib/prisma";
import { getActivities, getWellness } from "@/lib/intervals-client";
import { dateKeyLocal, dayKeyDate } from "@/lib/tz";
import { refreshAthleteMetrics } from "@/lib/athlete-metrics";
import { getIntervalsCreds } from "@/lib/intervals-creds";
import { detectPlanDeviation } from "@/lib/training-engine/deviation";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Clima de la salida según Intervals.icu (estimado por la ruta; solo si la cuenta lo tiene y la actividad tiene GPS). */
function mapWeather(a: any) {
  if (!a.has_weather) return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    temp: n(a.average_weather_temp), tempMin: n(a.min_weather_temp), tempMax: n(a.max_weather_temp),
    feels: n(a.average_feels_like), feelsMin: n(a.min_feels_like), feelsMax: n(a.max_feels_like),
    windMs: n(a.average_wind_speed), gustMs: n(a.average_wind_gust), windDeg: n(a.prevailing_wind_deg),
    headPct: n(a.headwind_percent), tailPct: n(a.tailwind_percent),
    clouds: n(a.average_clouds), rain: n(a.max_rain), snow: n(a.max_snow),
  };
}

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
    kilojoules: a.icu_joules != null ? a.icu_joules / 1000 : null, // Intervals lo entrega en julios
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
    // Carbohidratos que el atleta cargó en Intervals (si existe el campo); undefined = no pisar lo guardado
    intervalsCarbsG: typeof a.carbs_ingested === "number" && a.carbs_ingested > 0 ? a.carbs_ingested : undefined,
    // Cajón flexible: zonas, resumen de intervalos en texto ("7x 3m 335w") y CTL/ATL al momento de la sesión
    rawStreamsJson:
      a.icu_zone_times || a.interval_summary || a.icu_ctl != null || a.has_weather
        ? {
            zoneTimes: a.icu_zone_times ?? null,
            hrZoneTimes: a.icu_hr_zone_times ?? null,
            intervalSummary: a.interval_summary ?? null,
            ctl: a.icu_ctl ?? null,
            atl: a.icu_atl ?? null,
            weather: mapWeather(a),
          }
        : undefined,
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

const RIDE_TYPES = new Set(["Ride", "VirtualRide", "GravelRide", "MountainBikeRide", "EBikeRide"]);

/**
 * Vincula cada actividad de ciclismo con la sesión planificada de ese día (hora local del atleta):
 * guarda generatedWorkoutId, el TSS planeado y el desvío, y marca la sesión como COMPLETED.
 * Las actividades se guardan con la hora local como si fuera UTC, por eso el día sale de toISOString().
 * Una sesión se vincula con una sola actividad (la más larga del día, mínimo 20 min).
 */
export async function linkActivitiesToPlan(userId: string, sinceDays = 30): Promise<number> {
  const since = new Date(Date.now() - sinceDays * DAY_MS);
  const acts = await prisma.activity.findMany({
    where: { athleteId: userId, date: { gte: since }, generatedWorkoutId: null },
    orderBy: { durationSec: "desc" },
  });
  let linked = 0;
  const used = new Set<string>();
  for (const a of acts) {
    if (!RIDE_TYPES.has(a.type) || a.durationSec < 20 * 60) continue;
    const key = a.date.toISOString().slice(0, 10);
    const dayMs = Date.parse(`${key}T00:00:00Z`);
    const cands = await prisma.generatedWorkout.findMany({
      where: { athleteId: userId, date: { gte: new Date(dayMs - DAY_MS), lt: new Date(dayMs + 2 * DAY_MS) }, workoutLibraryKey: { not: "gym" } },
    });
    const w = cands
      .filter((c) => dateKeyLocal(c.date) === key && !used.has(c.id) && c.status !== "COMPLETED")
      .sort((x, y) => (y.estimatedTss ?? 0) - (x.estimatedTss ?? 0))[0];
    if (!w) continue;
    used.add(w.id);
    const planned = w.estimatedTss ?? null;
    const dev = detectPlanDeviation({ tss: a.tss, plannedTss: planned, decouplingPct: a.decouplingPct });
    await prisma.activity.update({
      where: { id: a.id },
      data: { generatedWorkoutId: w.id, plannedTss: planned, deviationFlag: dev.flag, deviationNotes: dev.notes },
    });
    await prisma.generatedWorkout.update({ where: { id: w.id }, data: { status: "COMPLETED" } });
    linked++;
  }
  return linked;
}

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
  days = Math.min(Math.max(days, 1), 2200);
  const result: SyncResult = { activities: 0, wellness: 0, errors: [] };
  const creds = await getIntervalsCreds(userId);
  if (!creds) {
    result.errors.push("Intervals no está conectado (cargá tu athlete ID y tu API key en Configuración)");
    return result;
  }
  const { apiKey, athleteId } = creds;

  const now = new Date();
  const oldest = dateKeyLocal(new Date(now.getTime() - days * DAY_MS));
  const newest = dateKeyLocal(new Date(now.getTime() + DAY_MS)); // actividades: incluye "mañana" por el desfase horario
  const newestWellness = dateKeyLocal(now); // wellness: Intervals proyecta CTL/ATL a días futuros sin datos reales

  try {
    const activities: any[] = [];
    // Ventanas de hasta 1 año para no pedirle a la API un rango gigante de una sola vez
    for (let end = new Date(now.getTime() + DAY_MS); end.getTime() > now.getTime() - days * DAY_MS; end = new Date(end.getTime() - 365 * DAY_MS)) {
      const start = new Date(Math.max(end.getTime() - 365 * DAY_MS, now.getTime() - days * DAY_MS));
      activities.push(...(await getActivities(athleteId, apiKey, dateKeyLocal(start), dateKeyLocal(end))));
    }
    const list = activities as any[];
    for (let i = 0; i < list.length; i += 10) {
      await Promise.all(
        list.slice(i, i + 10).map(async (a) => {
          try {
            const mapped = mapActivity(a, userId);
            const { athleteId: _owner, ...rest } = mapped;
            void _owner;
            await prisma.activity.upsert({ where: { intervalsActivityId: mapped.intervalsActivityId }, update: rest, create: mapped });
            result.activities++;
          } catch (err) {
            result.errors.push(`Activity ${a?.id}: ${String(err)}`);
          }
        })
      );
    }
  } catch (err) {
    result.errors.push(`Actividades ${oldest}→${newest}: ${String(err)}`);
  }

  try {
    await linkActivitiesToPlan(userId, Math.max(days, 30));
  } catch (err) {
    result.errors.push(`Vinculación con el plan: ${String(err)}`);
  }

  try {
    const wellness: any[] = [];
    for (let end = now; end.getTime() > now.getTime() - days * DAY_MS; end = new Date(end.getTime() - 365 * DAY_MS)) {
      const start = new Date(Math.max(end.getTime() - 365 * DAY_MS, now.getTime() - days * DAY_MS));
      wellness.push(...(await getWellness(athleteId, apiKey, dateKeyLocal(start), dateKeyLocal(end))));
    }
    const wl = wellness as any[];
    for (let i = 0; i < wl.length; i += 10) {
      await Promise.all(
        wl.slice(i, i + 10).map(async (w) => {
          try {
            const mapped = mapWellness(w, userId);
            const { athleteId: _owner, ...rest } = mapped;
            void _owner;
            await prisma.wellness.upsert({ where: { athleteId_date: { athleteId: userId, date: mapped.date } }, update: rest, create: mapped });
            result.wellness++;
          } catch (err) {
            result.errors.push(`Wellness ${w?.id}: ${String(err)}`);
          }
        })
      );
    }
  } catch (err) {
    result.errors.push(`Wellness ${oldest}→${newest}: ${String(err)}`);
  }

  // Curva de potencia y configuración de deporte: cambian poco, se refrescan cada 6 h
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { powerCurveSyncedAt: true } });
    if (!u?.powerCurveSyncedAt || Date.now() - u.powerCurveSyncedAt.getTime() > 6 * 60 * 60 * 1000) {
      result.errors.push(...(await refreshAthleteMetrics(userId)));
    }
  } catch (err) {
    result.errors.push(`Métricas del atleta: ${String(err)}`);
  }

  // Solo marcamos la sync como hecha si al menos una de las dos llamadas funcionó
  if (result.activities > 0 || result.wellness > 0 || result.errors.length === 0) {
    await prisma.user.update({ where: { id: userId }, data: { intervalsLastSyncAt: new Date() } });
  }
  return result;
}

const inFlight = new Map<string, Promise<SyncResult>>();
/** Último intento fallido por usuario: evita reintentar (y esperar hasta 12 s) en cada carga de página. */
const failedAt = new Map<string, number>();

/** Días a re-sincronizar: lo mínimo (14) o, si hace mucho que no hay datos nuevos, desde el último dato conocido (+3 de margen). */
async function catchUpDays(userId: string): Promise<number> {
  const [lastAct, lastWell] = await Promise.all([
    prisma.activity.findFirst({ where: { athleteId: userId }, orderBy: { date: "desc" }, select: { date: true } }),
    prisma.wellness.findFirst({ where: { athleteId: userId }, orderBy: { date: "desc" }, select: { date: true } }),
  ]);
  const known = Math.min(lastAct?.date.getTime() ?? 0, lastWell?.date.getTime() ?? 0);
  if (!known) return 14;
  const gap = Math.ceil((Date.now() - known) / DAY_MS) + 3;
  return Math.min(Math.max(14, gap), 400);
}

/**
 * Sincroniza al abrir la app si la última sync tiene más de `maxAgeMin` minutos.
 * Nunca lanza, comparte la ejecución si ya hay una en curso y espera como máximo `timeoutMs`.
 */
export async function syncIfStale(userId: string, maxAgeMin = 5, timeoutMs = 12000): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { intervalsLastSyncAt: true } });
    const last = user?.intervalsLastSyncAt?.getTime() ?? 0;

    // Si todavía falta el HRV de hoy (el reloj sube el dato por la mañana), se reintenta cada minuto
    const todayRow = await prisma.wellness.findUnique({
      where: { athleteId_date: { athleteId: userId, date: dayKeyDate(new Date()) } },
      select: { hrv: true },
    });
    const effectiveMaxAge = todayRow?.hrv == null ? Math.min(maxAgeMin, 1) : maxAgeMin;
    if (Date.now() - last < effectiveMaxAge * 60 * 1000) return;

    if (Date.now() - (failedAt.get(userId) ?? 0) < 5 * 60 * 1000) return;
    let run = inFlight.get(userId);
    if (!run) {
      run = catchUpDays(userId)
        .then(async (d) => {
          const r = await syncIntervals(userId, d);
          if (r.errors.length > 0 && r.activities === 0 && r.wellness === 0) failedAt.set(userId, Date.now());
          return r;
        })
        .finally(() => inFlight.delete(userId));
      inFlight.set(userId, run);
    }
    await Promise.race([run, new Promise((r) => setTimeout(r, timeoutMs))]);
  } catch (err) {
    console.error("syncIfStale falló:", err);
  }
}
