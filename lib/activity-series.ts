import { gunzipSync } from "node:zlib";
import FitParser from "fit-file-parser";
import { prisma } from "@/lib/prisma";
import { getActivityFile, getActivityStreams } from "@/lib/intervals-client";
import { getIntervalsCreds } from "@/lib/intervals-creds";

/** Series de una salida, promediadas cada `stepSec` segundos. null = sin dato en ese tramo. */
export interface ActivitySeries {
  source: "fit" | "streams" | "none";
  fetchedAt: string;
  stepSec: number;
  power: (number | null)[];
  hr: (number | null)[];
  cadence: (number | null)[];
  /** km/h */
  speed: (number | null)[];
  /** metros */
  altitude: (number | null)[];
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const MAX_POINTS = 2200;

/** Paso de agrupación: 5 s, o más si la salida es muy larga (para no guardar miles de puntos). */
export function stepFor(durationSec: number): number {
  return Math.max(5, Math.ceil(durationSec / MAX_POINTS / 5) * 5);
}

interface Sample { t: number; power: number | null; hr: number | null; cadence: number | null; speed: number | null; altitude: number | null }

/** Agrupa muestras (cualquier frecuencia) en baldes de `step` s promediando lo que haya; huecos = null. */
export function bucketSamples(samples: Sample[], step: number): Omit<ActivitySeries, "source" | "fetchedAt"> | null {
  if (!samples.length) return null;
  const t0 = samples[0].t;
  const n = Math.floor((samples[samples.length - 1].t - t0) / (step * 1000)) + 1;
  if (n < 2) return null;
  const keys = ["power", "hr", "cadence", "speed", "altitude"] as const;
  const sum: Record<string, number[]> = {};
  const cnt: Record<string, number[]> = {};
  for (const k of keys) { sum[k] = new Array(n).fill(0); cnt[k] = new Array(n).fill(0); }
  for (const s of samples) {
    const i = Math.min(n - 1, Math.floor((s.t - t0) / (step * 1000)));
    for (const k of keys) {
      const v = s[k];
      if (v == null) continue;
      sum[k][i] += v;
      cnt[k][i]++;
    }
  }
  const out = {} as Record<(typeof keys)[number], (number | null)[]>;
  for (const k of keys) {
    const dec = k === "speed" ? 10 : 1;
    out[k] = sum[k].map((s, i) => (cnt[k][i] ? Math.round((s / cnt[k][i]) * dec) / dec : null));
  }
  return { stepSec: step, ...out };
}

/** Lee las series del archivo FIT original (potencia, FC, cadencia, velocidad y altitud). */
export async function parseFitSeries(input: Uint8Array, durationSec: number): Promise<Omit<ActivitySeries, "source" | "fetchedAt"> | null> {
  let buf = Buffer.from(input);
  if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  const data = await new FitParser({ mode: "list", force: true }).parseAsync(buf);
  const samples: Sample[] = [];
  for (const r of (data.records ?? []) as Record<string, unknown>[]) {
    const t = r.timestamp instanceof Date ? r.timestamp.getTime() : null;
    if (t == null) continue;
    const sp = num(r.enhanced_speed) ?? num(r.speed);
    samples.push({
      t,
      power: num(r.power),
      hr: num(r.heart_rate),
      cadence: num(r.cadence),
      speed: sp != null ? sp * 3.6 : null, // m/s → km/h
      altitude: num(r.enhanced_altitude) ?? num(r.altitude),
    });
  }
  samples.sort((a, b) => a.t - b.t);
  const out = bucketSamples(samples, stepFor(durationSec));
  return out && hasData(out) ? out : null;
}

const hasData = (s: Omit<ActivitySeries, "source" | "fetchedAt">) => [s.power, s.hr, s.cadence, s.speed, s.altitude].some((a) => a.some((v) => v != null));

/**
 * Series de la salida, guardadas la primera vez que se piden.
 * Orden: archivo original (FIT) → streams de Intervals.icu → "none" (se guarda para no reintentar).
 * Un error de red NO se guarda: se reintenta la próxima vez.
 */
export async function ensureActivitySeries(activityId: string): Promise<ActivitySeries | null> {
  const a = await prisma.activity.findUnique({ where: { id: activityId }, select: { id: true, athleteId: true, intervalsActivityId: true, durationSec: true, seriesJson: true } });
  if (!a) return null;
  const cached = a.seriesJson as unknown as ActivitySeries | null;
  if (cached) return cached.source === "none" ? null : cached;
  const creds = await getIntervalsCreds(a.athleteId);
  if (!creds) return null;

  let parsed: Omit<ActivitySeries, "source" | "fetchedAt"> | null = null;
  let source: ActivitySeries["source"] = "none";
  const file = await getActivityFile(creds.apiKey, a.intervalsActivityId);
  if (file) {
    try {
      parsed = await parseFitSeries(file, a.durationSec);
      if (parsed) source = "fit";
    } catch (e) {
      console.error("No se pudieron leer las series del FIT", a.id, e);
    }
  }
  if (!parsed) {
    const samples = await getActivityStreams(creds.apiKey, a.intervalsActivityId);
    const b = samples ? bucketSamples(samples, stepFor(a.durationSec)) : null;
    if (b && hasData(b)) { parsed = b; source = "streams"; }
  }
  const stored: ActivitySeries | null = parsed
    ? { source, fetchedAt: new Date().toISOString(), ...parsed }
    : null;
  await prisma.activity.update({
    where: { id: a.id },
    data: { seriesJson: (stored ?? { source: "none", fetchedAt: new Date().toISOString() }) as object },
  });
  return stored;
}
