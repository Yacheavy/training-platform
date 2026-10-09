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
  return `${head}\n${[...rows, ...extra].join("\n")}${work}`;
}

/**
 * Devuelve las vueltas de una actividad, guardándolas la primera vez (no se pisan al sincronizar).
 * Orden: archivo original (FIT) → intervalos de Intervals.icu → "none". Un error de red NO se guarda para poder reintentar.
 */
export async function ensureActivityLaps(activityId: string): Promise<StoredLaps | null> {
  const a = await prisma.activity.findUnique({ where: { id: activityId }, select: { id: true, athleteId: true, intervalsActivityId: true, lapsJson: true } });
  if (!a) return null;
  const cached = a.lapsJson as unknown as StoredLaps | null;
  if (cached?.laps && cached.source !== "none") return cached;
  if (cached?.source === "none") return null;
  const creds = await getIntervalsCreds(a.athleteId);
  if (!creds) return null;

  let stored: StoredLaps = { source: "none", fetchedAt: new Date().toISOString(), laps: [] };
  const file = await getActivityFile(creds.apiKey, a.intervalsActivityId);
  if (file) {
    try {
      const laps = await parseFitLaps(file);
      if (laps.length >= 2) stored = { source: "fit", fetchedAt: stored.fetchedAt, laps };
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
    if (laps.length > 0) stored = { source: "intervals", fetchedAt: stored.fetchedAt, laps };
  }
  await prisma.activity.update({ where: { id: a.id }, data: { lapsJson: stored as object } });
  return stored.source === "none" ? null : stored;
}
