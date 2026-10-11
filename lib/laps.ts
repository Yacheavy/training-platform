import { gunzipSync } from "node:zlib";
import FitParser from "fit-file-parser";
import { prisma } from "@/lib/prisma";
import { getActivityFile, getActivityWithIntervals } from "@/lib/intervals-client";
import { getIntervalsCreds } from "@/lib/intervals-creds";

/** Una vuelta: lo que el atleta marcó con el botón del dispositivo (o un intervalo detectado, si no hay archivo). */
export interface Lap {
  n: number;
  startSec: number;
  durSec: number;
  avgW: number | null;
  maxW: number | null;
  avgHr: number | null;
  maxHr: number | null;
  cad: number | null;
}
export interface StoredLaps {
  source: "fit" | "intervals" | "none";
  fetchedAt: string;
  laps: Lap[];
  /** Potencia media cada 5 s (W) del archivo original; [] = ya se intentó y el archivo no la trae; ausente = todavía no se leyó. */
  power5?: number[];
}

const BUCKET_SEC = 5;

/** Potencia media cada 5 s a partir de los registros del FIT (huecos = 0). */
export async function parseFitPower(input: Uint8Array): Promise<number[]> {
  let buf = Buffer.from(input);
  if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  const data = await new FitParser({ mode: "list", force: true }).parseAsync(buf);
  const recs = ((data.records ?? []) as Record<string, unknown>[])
    .map((r) => ({ t: r.timestamp instanceof Date ? r.timestamp.getTime() : null, p: num(r.power) }))
    .filter((r): r is { t: number; p: number | null } => r.t != null);
  if (!recs.length || !recs.some((r) => r.p != null)) return [];
  const t0 = recs[0].t;
  const n = Math.floor((recs[recs.length - 1].t - t0) / (BUCKET_SEC * 1000)) + 1;
  const sum = new Array<number>(n).fill(0);
  const cnt = new Array<number>(n).fill(0);
  for (const r of recs) {
    if (r.p == null) continue;
    const i = Math.floor((r.t - t0) / (BUCKET_SEC * 1000));
    sum[i] += r.p;
    cnt[i]++;
  }
  return sum.map((s, i) => (cnt[i] ? Math.round(s / cnt[i]) : 0));
}

export interface SustainedEffort {
  startSec: number;
  durSec: number;
  avgW: number;
}

/**
 * Tramos sostenidos de potencia alta dentro de una vuelta larga o de una salida sin vueltas marcadas: tramos donde el promedio móvil de 30 s
 * está en o sobre `minPct` del FTP (por defecto 90%), uniendo cortes de hasta 20 s, de al menos `minDurSec`. Criterio práctico, no una norma.
 */
export function sustainedEfforts(power5: number[], ftp: number, minPct = 0.9, minDurSec = 90): SustainedEffort[] {
  if (!power5.length || !(ftp > 0)) return [];
  const hot = power5.map((_, i) => {
    const a = Math.max(0, i - 3);
    const b = Math.min(power5.length - 1, i + 2);
    let s = 0;
    for (let k = a; k <= b; k++) s += power5[k];
    return s / (b - a + 1) >= minPct * ftp;
  });
  const runs: [number, number][] = [];
  let i = 0;
  while (i < hot.length) {
    if (!hot[i]) { i++; continue; }
    let j = i;
    while (j + 1 < hot.length && hot[j + 1]) j++;
    const last = runs[runs.length - 1];
    if (last && i - last[1] - 1 <= 4) last[1] = j;
    else runs.push([i, j]);
    i = j + 1;
  }
  return runs
    .map(([a, b]) => {
      const seg = power5.slice(a, b + 1);
      return { startSec: a * BUCKET_SEC, durSec: seg.length * BUCKET_SEC, avgW: Math.round(seg.reduce((s, x) => s + x, 0) / seg.length) };
    })
    .filter((e) => e.durSec >= minDurSec);
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const rnd = (v: number | null) => (v == null ? null : Math.round(v));

/** Lee las vueltas de un archivo FIT (acepta también .fit.gz). */
export async function parseFitLaps(input: Uint8Array): Promise<Lap[]> {
  let buf = Buffer.from(input);
  if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  const data = await new FitParser({ mode: "list", force: true }).parseAsync(buf);
  const raw = (data.laps ?? []) as Record<string, unknown>[];
  const t0 = raw.map((l) => (l.start_time instanceof Date ? l.start_time.getTime() : null)).find((t) => t != null) ?? 0;
  return raw
    .map((l, i) => {
      const dur = num(l.total_timer_time) ?? num(l.total_elapsed_time) ?? 0;
      const start = l.start_time instanceof Date ? l.start_time.getTime() : null;
      return {
        n: i + 1,
        startSec: start != null ? Math.round((start - t0) / 1000) : 0,
        durSec: Math.round(dur),
        avgW: rnd(num(l.avg_power)),
        maxW: rnd(num(l.max_power)),
        avgHr: rnd(num(l.avg_heart_rate)),
        maxHr: rnd(num(l.max_heart_rate)),
        cad: rnd(num(l.avg_cadence)),
      };
    })
    .filter((l) => l.durSec > 0);
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Esfuerzos cortos de alta potencia (sprints, 30/15) en orden cronológico; null si no hay FTP o ninguno. */
export function shortEfforts(laps: Lap[], ftp?: number | null) {
  if (!ftp || ftp <= 0) return null;
  const thresholdW = Math.round(1.15 * ftp);
  const list = laps.filter((l) => l.durSec >= 10 && l.durSec < 60 && l.avgW != null && l.avgW >= thresholdW) as (Lap & { avgW: number })[];
  if (!list.length) return null;
  let strongest = 0;
  let weakest = 0;
  list.forEach((l, i) => {
    if (l.avgW > list[strongest].avgW) strongest = i;
    if (l.avgW < list[weakest].avgW) weakest = i;
  });
  return { thresholdW, list, strongest, weakest };
}

/** Texto compacto para el modelo: una línea por vuelta y un conteo de vueltas "de trabajo" con el criterio explícito. */
export function describeLaps(stored: StoredLaps, ftp?: number | null): string {
  const laps = stored.laps;
  const max = 60;
  const rows = laps.slice(0, max).map((l) => `V${l.n} +${mmss(l.startSec)} dur ${mmss(l.durSec)}: ${l.avgW != null ? `${l.avgW} W` : "sin potencia"}${l.maxW != null ? ` (máx ${l.maxW})` : ""}${l.avgHr != null ? `, ${l.avgHr} lpm` : ""}${l.cad != null ? `, ${l.cad} rpm` : ""}`);
  const extra = laps.length > max ? [`… y ${laps.length - max} vueltas más`] : [];
  const head =
    stored.source === "fit"
      ? "Vueltas (laps) del archivo original: son las que marcó el atleta con el botón de su dispositivo y la fuente MÁS fiel de lo realmente hecho (cada intervalo se marca como una vuelta; también hay vueltas de calentamiento, recuperación y enfriamiento). El resumen automático de Intervals.icu puede omitir o fusionar intervalos: si difieren, prevalecen las vueltas. Si las vueltas parecen automáticas (todas de igual duración o distancia y sin estructura de esfuerzo), no las trates como intervalos y decilo."
      : "Intervalos detectados automáticamente por Intervals.icu (no se encontró el archivo con las vueltas; la detección puede omitir o fusionar intervalos, tomá estos números como aproximados).";
  let work = "";
  if (ftp && ftp > 0) {
    const hard = laps.filter((l) => l.durSec >= 60 && l.avgW != null && l.avgW >= 0.9 * ftp);
    work = `\nVueltas de 60 s o más con potencia media ≥ 90% del FTP (${Math.round(0.9 * ftp)} W; criterio práctico para contar el trabajo duro): ${hard.length}${hard.length ? ` (${hard.map((l) => `V${l.n}`).join(", ")})` : ""}.`;
  }
  // Esfuerzos cortos (sprints, 30/15, etc.) numerados en orden: así el modelo no confunde cuál fue el primero ni cuántos hubo
  let efforts = "";
  const se = shortEfforts(laps, ftp);
  if (se) {
    efforts = `\nEsfuerzos cortos (10–59 s) con potencia media ≥ 115% del FTP (${se.thresholdW} W), en orden cronológico, ${se.list.length} en total: ${se.list.map((l, i) => `${i + 1}º = V${l.n}, ${l.durSec} s, ${l.avgW} W`).join("; ")}. El más fuerte fue el ${se.strongest + 1}º (${se.list[se.strongest].avgW} W) y el más flojo el ${se.weakest + 1}º (${se.list[se.weakest].avgW} W). Para numerar o contar esfuerzos usá SOLO esta lista.`;
  }
  // Tramos sostenidos leídos de la potencia segundo a segundo: sirven cuando las vueltas son largas y no separan los esfuerzos
  let sustained = "";
  if (stored.power5?.length && ftp && ftp > 0) {
    const list = sustainedEfforts(stored.power5, ftp);
    const maxList = 20;
    if (list.length) {
      const totalSec = list.reduce((s, e) => s + e.durSec, 0);
      sustained = `\nTramos sostenidos de potencia alta leídos de la potencia segundo a segundo (promedio móvil de 30 s ≥ 90% del FTP = ${Math.round(0.9 * ftp)} W, de 90 s o más, cortes de hasta 20 s unidos), en orden cronológico, ${list.length} en total (${Math.round(totalSec / 60)} min sumados): ${list.slice(0, maxList).map((e) => `+${mmss(e.startSec)} ${mmss(e.durSec)} a ${e.avgW} W (${Math.round((e.avgW / ftp) * 100)}% del FTP)`).join("; ")}${list.length > maxList ? `; … y ${list.length - maxList} más` : ""}. Para hablar de la intensidad de un tramo usá estos vatios y su % del FTP; no uses «cerca del FTP» sin el número.`;
    } else {
      sustained = `\nTramos sostenidos de potencia alta (promedio móvil de 30 s ≥ 90% del FTP = ${Math.round(0.9 * ftp)} W, de 90 s o más): ninguno.`;
    }
  }
  return `${head}\n${[...rows, ...extra].join("\n")}${work}${efforts}${sustained}`;
}

/**
 * Devuelve las vueltas de una actividad, guardándolas la primera vez (no se pisan al sincronizar).
 * Orden: archivo original (FIT) → intervalos de Intervals.icu → "none". Un error de red NO se guarda para poder reintentar.
 */
export async function ensureActivityLaps(activityId: string): Promise<StoredLaps | null> {
  const a = await prisma.activity.findUnique({ where: { id: activityId }, select: { id: true, athleteId: true, intervalsActivityId: true, lapsJson: true } });
  if (!a) return null;
  const cached = a.lapsJson as unknown as StoredLaps | null;
  if (cached?.source === "none") return null;
  if (cached?.laps && cached.power5 !== undefined) return cached;
  const creds = await getIntervalsCreds(a.athleteId);
  if (cached?.laps) {
    // Vueltas ya guardadas antes de leer la potencia segundo a segundo: se completa una sola vez (si no hay archivo, se marca para no reintentar)
    let power5: number[] = [];
    try {
      const f = creds ? await getActivityFile(creds.apiKey, a.intervalsActivityId) : null;
      if (f) power5 = await parseFitPower(f);
    } catch (e) {
      console.error("No se pudo leer la potencia del FIT", a.id, e);
    }
    const upd: StoredLaps = { ...cached, power5 };
    await prisma.activity.update({ where: { id: a.id }, data: { lapsJson: upd as object } });
    return upd;
  }
  if (!creds) return null;

  let stored: StoredLaps = { source: "none", fetchedAt: new Date().toISOString(), laps: [] };
  const file = await getActivityFile(creds.apiKey, a.intervalsActivityId);
  if (file) {
    try {
      const laps = await parseFitLaps(file);
      if (laps.length >= 2) stored = { source: "fit", fetchedAt: stored.fetchedAt, laps, power5: await parseFitPower(file).catch(() => []) };
    } catch (e) {
      console.error("No se pudo leer el FIT de la actividad", a.id, e);
    }
  }
  if (stored.source === "none") {
    const act = await getActivityWithIntervals(creds.apiKey, a.intervalsActivityId);
    const list = (act?.icu_intervals ?? []) as Record<string, unknown>[];
    const laps = list
      .map((x, i) => ({ n: i + 1, startSec: Math.round(num(x.start_time) ?? 0), durSec: Math.round(num(x.moving_time) ?? num(x.elapsed_time) ?? 0), avgW: rnd(num(x.average_watts)), maxW: rnd(num(x.max_watts)), avgHr: rnd(num(x.average_heartrate)), maxHr: rnd(num(x.max_heartrate)), cad: rnd(num(x.average_cadence)) }))
      .filter((l) => l.durSec > 0);
    if (laps.length > 0) stored = { source: "intervals", fetchedAt: stored.fetchedAt, laps, power5: [] };
  }
  await prisma.activity.update({ where: { id: a.id }, data: { lapsJson: stored as object } });
  return stored.source === "none" ? null : stored;
}
