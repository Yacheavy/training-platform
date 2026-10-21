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
  /** Dinámica de pedaleo del archivo FIT (medidores de potencia por pierna). null = el archivo no la trae; ausente = todavía no se leyó. */
  dynamics?: PedalDynamics | null;
}

export interface DynamicsBin { label: string; seconds: number; avgW: number | null; teLeft: number | null; teRight: number | null; psLeft: number | null; psRight: number | null; balanceLeft: number | null }
export interface PedalDynamics {
  /** Segundos con potencia > 0 y al menos una de estas métricas. */
  seconds: number;
  balanceLeft: number | null;
  teLeft: number | null;
  teRight: number | null;
  psLeft: number | null;
  psRight: number | null;
  /** Por rango de cadencia (solo rangos con 2 min o más pedaleando). */
  byCadence: DynamicsBin[];
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const MAX_POINTS = 2200;

/** Paso de agrupación: 5 s, o más si la salida es muy larga (para no guardar miles de puntos). */
export function stepFor(durationSec: number): number {
  return Math.max(5, Math.ceil(durationSec / MAX_POINTS / 5) * 5);
}

interface Sample { t: number; power: number | null; hr: number | null; cadence: number | null; speed: number | null; altitude: number | null }
interface DynSample { power: number | null; cadence: number | null; teL: number | null; teR: number | null; psL: number | null; psR: number | null; balL: number | null }

/** left_right_balance del FIT: puede venir como número (bit 0x80 = el valor es el % de la pierna derecha) o como objeto {value, right}. Devuelve % de la pierna izquierda. */
export function leftBalance(v: unknown): number | null {
  if (v && typeof v === "object") {
    const o = v as { value?: unknown; right?: unknown };
    const val = num(o.value);
    if (val == null || val < 0 || val > 100) return null;
    return o.right === true ? 100 - val : val;
  }
  const n = num(v);
  if (n == null) return null;
  if (n === 0xffff || n === 0xff) return null;
  if (n & 0x80) { const r = n & 0x7f; return r > 100 ? null : 100 - r; }
  return n <= 100 ? n : null;
}

const CAD_BINS: [number, number, string][] = [[1, 70, "menos de 70 rpm"], [70, 80, "70–79 rpm"], [80, 90, "80–89 rpm"], [90, 100, "90–99 rpm"], [100, 999, "100 rpm o más"]];

/** Promedios de la dinámica de pedaleo (solo con potencia > 0). null si el archivo no trae TE/PS ni balance. */
export function summarizeDynamics(rows: DynSample[]): PedalDynamics | null {
  const valid = rows.filter((r) => r.power != null && r.power > 0 && (r.teL != null || r.teR != null || r.psL != null || r.psR != null || r.balL != null));
  if (valid.length < 60) return null;
  const avg = (get: (r: DynSample) => number | null, set: DynSample[] = valid) => {
    const v = set.map(get).filter((x): x is number => x != null);
    return v.length >= 30 ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const byCadence: DynamicsBin[] = [];
  for (const [lo, hi, label] of CAD_BINS) {
    const set = valid.filter((r) => r.cadence != null && r.cadence >= lo && r.cadence < hi);
    if (set.length < 120) continue;
    byCadence.push({ label, seconds: set.length, avgW: avg((r) => r.power, set), teLeft: avg((r) => r.teL, set), teRight: avg((r) => r.teR, set), psLeft: avg((r) => r.psL, set), psRight: avg((r) => r.psR, set), balanceLeft: avg((r) => r.balL, set) });
  }
  const out: PedalDynamics = { seconds: valid.length, balanceLeft: avg((r) => r.balL), teLeft: avg((r) => r.teL), teRight: avg((r) => r.teR), psLeft: avg((r) => r.psL), psRight: avg((r) => r.psR), byCadence };
  return [out.balanceLeft, out.teLeft, out.teRight, out.psLeft, out.psRight].every((x) => x == null) ? null : out;
}

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
  const dyn: DynSample[] = [];
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
    const psC = num(r.combined_pedal_smoothness);
    dyn.push({
      power: num(r.power), cadence: num(r.cadence),
      teL: num(r.left_torque_effectiveness), teR: num(r.right_torque_effectiveness),
      psL: num(r.left_pedal_smoothness) ?? psC, psR: num(r.right_pedal_smoothness) ?? psC,
      balL: leftBalance(r.left_right_balance),
    });
  }
  samples.sort((a, b) => a.t - b.t);
  const out = bucketSamples(samples, stepFor(durationSec));
  return out && hasData(out) ? { ...out, dynamics: summarizeDynamics(dyn) } : null;
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
  if (cached && !(cached.source === "fit" && cached.dynamics === undefined)) return cached.source === "none" ? null : cached;
  const creds = await getIntervalsCreds(a.athleteId);
  if (!creds) return cached && cached.source !== "none" ? cached : null;

  let parsed: Omit<ActivitySeries, "source" | "fetchedAt"> | null = null;
  let source: ActivitySeries["source"] = "none";
  const refresh = !!cached && cached.source !== "none";
  // Al releer una serie ya guardada (solo para sumar la dinámica), un error de red no debe romper la pantalla: se devuelve lo guardado
  const file = refresh ? await getActivityFile(creds.apiKey, a.intervalsActivityId).catch(() => undefined) : await getActivityFile(creds.apiKey, a.intervalsActivityId);
  if (refresh && file === undefined) return cached;
  if (file) {
    try {
      parsed = await parseFitSeries(file, a.durationSec);
      if (parsed) source = "fit";
    } catch (e) {
      console.error("No se pudieron leer las series del FIT", a.id, e);
    }
  }
  if (refresh && !parsed) {
    const keep = { ...(cached as ActivitySeries), dynamics: null };
    await prisma.activity.update({ where: { id: a.id }, data: { seriesJson: keep as object } });
    return keep;
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
