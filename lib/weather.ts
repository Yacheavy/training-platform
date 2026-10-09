import { gunzipSync } from "node:zlib";
import FitParser from "fit-file-parser";
import { prisma } from "@/lib/prisma";
import { getActivityFile } from "@/lib/intervals-client";
import { getIntervalsCreds } from "@/lib/intervals-creds";

/** Clima de una salida, siempre en °C y km/h. `source` dice de dónde sale: Intervals.icu (cuenta premium) u Open-Meteo (respaldo por GPS). */
export interface WeatherView {
  source: "intervals" | "open-meteo";
  temp: number | null;
  tempMin: number | null;
  tempMax: number | null;
  feels: number | null;
  feelsMax: number | null;
  windKmh: number | null;
  gustKmh: number | null;
  windDeg: number | null;
  headPct: number | null;
  tailPct: number | null;
  clouds: number | null;
  rain: number | null;
}
export interface ActivityWeather {
  weather: WeatherView | null;
  /** Temperatura medida por el sensor del dispositivo (Intervals la guarda en la versión gratuita). */
  deviceTemp: { avg: number | null; min: number | null; max: number | null } | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Los archivos FIT guardan la posición en "semicírculos"; si el parser ya entregó grados, se deja como está. */
export function toDegrees(v: number): number {
  return Math.abs(v) > 180 ? (v * 180) / 2147483648 : v;
}

const validPoint = (lat: number | null, lon: number | null): lat is number =>
  lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);

/** Primer punto con GPS del archivo (el inicio de la salida). Devuelve null si no hay (rodillo, sin GPS). */
export async function parseFitStart(input: Uint8Array): Promise<{ lat: number; lon: number } | null> {
  let buf = Buffer.from(input);
  if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  const data = await new FitParser({ mode: "list", force: true }).parseAsync(buf);
  const records = (data.records ?? []) as Record<string, unknown>[];
  for (const r of records) {
    const la = num(r.position_lat);
    const lo = num(r.position_long);
    if (la != null && lo != null) {
      const lat = toDegrees(la);
      const lon = toDegrees(lo);
      if (validPoint(lat, lon)) return { lat, lon };
    }
  }
  const s = ((data.sessions ?? []) as Record<string, unknown>[])[0];
  const la = num(s?.start_position_lat);
  const lo = num(s?.start_position_long);
  if (la != null && lo != null) {
    const lat = toDegrees(la);
    const lon = toDegrees(lo);
    if (validPoint(lat, lon)) return { lat, lon };
  }
  return null;
}

export interface OpenMeteoHourly {
  time: string[];
  temperature_2m?: (number | null)[];
  apparent_temperature?: (number | null)[];
  wind_speed_10m?: (number | null)[];
  wind_gusts_10m?: (number | null)[];
  wind_direction_10m?: (number | null)[];
  precipitation?: (number | null)[];
  cloud_cover?: (number | null)[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Promedia las horas que cubre la salida. `start` es la hora local de inicio guardada como si fuera UTC (así se guardan las actividades)
 * y las horas de Open-Meteo vienen en hora local del lugar (timezone=auto), por eso se comparan como texto.
 */
export function aggregateHourly(h: OpenMeteoHourly, start: Date, durationSec: number): WeatherView | null {
  const t0 = start.getTime();
  const hours = new Set<string>();
  for (let t = Math.floor(t0 / 3_600_000); t <= Math.floor((t0 + Math.max(durationSec, 60) * 1000) / 3_600_000); t++) {
    hours.add(new Date(t * 3_600_000).toISOString().slice(0, 13) + ":00");
  }
  const idx = h.time.map((t, i) => (hours.has(t) ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 0) return null;
  const pick = (arr?: (number | null)[]) => (arr ? idx.map((i) => arr[i]).filter((v): v is number => typeof v === "number") : []);
  const temp = pick(h.temperature_2m);
  const feels = pick(h.apparent_temperature);
  const wind = pick(h.wind_speed_10m);
  const gust = pick(h.wind_gusts_10m);
  const rain = pick(h.precipitation);
  const clouds = pick(h.cloud_cover);
  const dirs = pick(h.wind_direction_10m);
  let windDeg: number | null = null;
  if (dirs.length) {
    const x = dirs.reduce((a, d) => a + Math.cos((d * Math.PI) / 180), 0);
    const y = dirs.reduce((a, d) => a + Math.sin((d * Math.PI) / 180), 0);
    windDeg = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
  }
  if (!temp.length && !feels.length) return null;
  return {
    source: "open-meteo",
    temp: mean(temp),
    tempMin: temp.length ? Math.min(...temp) : null,
    tempMax: temp.length ? Math.max(...temp) : null,
    feels: mean(feels),
    feelsMax: feels.length ? Math.max(...feels) : null,
    windKmh: mean(wind),
    gustKmh: gust.length ? Math.max(...gust) : null,
    windDeg,
    headPct: null,
    tailPct: null,
    clouds: mean(clouds),
    rain: rain.length ? Math.max(...rain) : null,
  };
}

async function fetchOpenMeteo(lat: number, lon: number, start: Date, durationSec: number): Promise<WeatherView | null> {
  const startDay = start.toISOString().slice(0, 10);
  const endDay = new Date(start.getTime() + durationSec * 1000).toISOString().slice(0, 10);
  const ageDays = (Date.now() - Date.parse(`${startDay}T00:00:00Z`)) / 86_400_000;
  // El pronóstico "best match" cubre los últimos ~3 meses con datos al día; más atrás se usa el archivo histórico
  const base = ageDays <= 80 ? "https://api.open-meteo.com/v1/forecast" : "https://archive-api.open-meteo.com/v1/archive";
  const qs = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    start_date: startDay,
    end_date: endDay,
    hourly: "temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,cloud_cover",
    wind_speed_unit: "kmh",
    timezone: "auto",
  });
  const res = await fetch(`${base}?${qs}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const json = (await res.json()) as { hourly?: OpenMeteoHourly };
  return json.hourly ? aggregateHourly(json.hourly, start, durationSec) : null;
}

const OUTDOOR_RIDES = new Set(["Ride", "GravelRide", "MountainBikeRide", "EBikeRide"]);

/** Clima del campo `rawStreamsJson.weather` que guarda la sync cuando la cuenta de Intervals lo trae (velocidades en m/s). */
function fromIntervals(w: Record<string, number | null> | null | undefined): WeatherView | null {
  if (!w || (w.temp == null && w.feels == null)) return null;
  return {
    source: "intervals",
    temp: num(w.temp), tempMin: num(w.tempMin), tempMax: num(w.tempMax),
    feels: num(w.feels), feelsMax: num(w.feelsMax),
    windKmh: w.windMs != null ? w.windMs * 3.6 : null,
    gustKmh: w.gustMs != null ? w.gustMs * 3.6 : null,
    windDeg: num(w.windDeg), headPct: num(w.headPct), tailPct: num(w.tailPct),
    clouds: num(w.clouds), rain: num(w.rain),
  };
}

/**
 * Clima de una actividad: 1) el de Intervals si la cuenta lo trae; 2) si no, Open-Meteo con el punto de inicio del archivo FIT.
 * Se guarda el resultado (sin coordenadas) para no consultar de nuevo; un error de red no se guarda, así se reintenta.
 * Nunca debe romper el análisis: ante cualquier problema devuelve lo que haya.
 */
export async function ensureActivityWeather(activityId: string): Promise<ActivityWeather> {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, athleteId: true, intervalsActivityId: true, type: true, date: true, durationSec: true, rawStreamsJson: true, weatherJson: true },
  });
  if (!a) return { weather: null, deviceTemp: null };
  const raw = a.rawStreamsJson as { weather?: Record<string, number | null> | null; deviceTemp?: { avg: number | null; min: number | null; max: number | null } | null } | null;
  const deviceTemp = raw?.deviceTemp && (raw.deviceTemp.avg != null || raw.deviceTemp.max != null) ? raw.deviceTemp : null;

  const fromIcu = fromIntervals(raw?.weather);
  if (fromIcu) return { weather: fromIcu, deviceTemp };

  const cached = a.weatherJson as ({ source: "open-meteo"; weather: WeatherView } | { source: "none" }) | null;
  if (cached?.source === "open-meteo") return { weather: cached.weather, deviceTemp };
  if (cached?.source === "none" || !OUTDOOR_RIDES.has(a.type)) return { weather: null, deviceTemp };

  try {
    const creds = await getIntervalsCreds(a.athleteId);
    if (!creds) return { weather: null, deviceTemp };
    const file = await getActivityFile(creds.apiKey, a.intervalsActivityId);
    if (!file) return { weather: null, deviceTemp };
    const start = await parseFitStart(file);
    if (!start) {
      await prisma.activity.update({ where: { id: a.id }, data: { weatherJson: { source: "none", checkedAt: new Date().toISOString() } } });
      return { weather: null, deviceTemp };
    }
    const weather = await fetchOpenMeteo(start.lat, start.lon, a.date, a.durationSec);
    if (!weather) return { weather: null, deviceTemp };
    await prisma.activity.update({ where: { id: a.id }, data: { weatherJson: { source: "open-meteo", fetchedAt: new Date().toISOString(), weather } as object } });
    return { weather, deviceTemp };
  } catch (e) {
    console.error("ensureActivityWeather falló", a.id, e);
    return { weather: null, deviceTemp };
  }
}

/** Texto para el modelo; el origen del dato va siempre explícito. */
export function describeWeather(w: ActivityWeather): string | null {
  const parts: string[] = [];
  const r = (v: number | null | undefined, u = "") => (v == null ? null : `${Math.round(v)}${u}`);
  if (w.weather) {
    const x = w.weather;
    const bits = [
      x.temp != null ? `temperatura media ${r(x.temp, " °C")}${x.tempMin != null && x.tempMax != null ? ` (${Math.round(x.tempMin)}–${Math.round(x.tempMax)} °C)` : ""}` : null,
      x.feels != null ? `sensación térmica media ${r(x.feels, " °C")}${x.feelsMax != null ? `, máxima ${r(x.feelsMax, " °C")}` : ""}` : null,
      x.windKmh != null ? `viento medio ${r(x.windKmh, " km/h")}${x.gustKmh != null ? ` (ráfagas ${r(x.gustKmh, " km/h")})` : ""}` : null,
      x.headPct != null && x.tailPct != null ? `viento de frente ${r(x.headPct, "%")} y de cola ${r(x.tailPct, "%")} del recorrido` : null,
      x.clouds != null ? `nubosidad ${r(x.clouds, "%")}` : null,
      x.rain != null && x.rain > 0 ? `lluvia máx. ${x.rain.toFixed(1)} mm/h` : null,
    ].filter(Boolean);
    const origin = x.source === "intervals" ? "estimado por Intervals.icu a partir de la ruta" : "estimado con Open-Meteo para la zona y la hora de la salida (modelo, no medición en el lugar; el viento es a 10 m de altura)";
    parts.push(`Clima durante la salida (${origin}; es una referencia): ${bits.join("; ")}.`);
  }
  if (w.deviceTemp) {
    const d = w.deviceTemp;
    parts.push(`Temperatura medida por el sensor del dispositivo del atleta: media ${r(d.avg, " °C")}${d.min != null && d.max != null ? ` (${Math.round(d.min)}–${Math.round(d.max)} °C)` : ""}; esos sensores suelen marcar de más al sol o pegados al cuerpo.`);
  }
  return parts.length ? parts.join("\n") : null;
}
