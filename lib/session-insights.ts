import { prisma } from "@/lib/prisma";
import { classifyStimulusType } from "@/lib/training-engine/stimulus-classifier";
import { shortEfforts, sustainedEfforts, type Lap, type StoredLaps } from "@/lib/laps";
import { dateKeyLocal } from "@/lib/tz";

/**
 * Hallazgos de una sesión calculados en código (no por la IA): caída de potencia dentro de la sesión, comparación con sesiones
 * anteriores del mismo tipo, reparto del esfuerzo por tercios y carga de la semana. El modelo los recibe ya hechos para interpretarlos,
 * no para recalcularlos. Todo es descriptivo: ninguno es un diagnóstico.
 */

const ar = (n: number, d = 0) => n.toFixed(d).replace(".", ",");
const sgn = (n: number, d = 1) => `${n >= 0 ? "+" : "−"}${ar(Math.abs(n), d)}`;
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;

export interface EffortStats {
  short: { n: number; meanW: number; firstThirdW: number; lastThirdW: number } | null;
  sustained: { n: number; meanW: number; firstW: number; lastW: number; totalMin: number } | null;
}

/** Esfuerzos cortos (≥115 % FTP, 10–59 s) y tramos sostenidos (≥90 % FTP, ≥90 s) de una sesión. */
export function effortStats(stored: StoredLaps | null | undefined, ftp: number): EffortStats {
  const out: EffortStats = { short: null, sustained: null };
  if (!stored || !(ftp > 0)) return out;
  const se = shortEfforts(stored.laps, ftp);
  if (se && se.list.length >= 3) {
    const w = se.list.map((l) => l.avgW);
    const k = Math.max(1, Math.floor(w.length / 3));
    out.short = { n: w.length, meanW: mean(w), firstThirdW: mean(w.slice(0, k)), lastThirdW: mean(w.slice(-k)) };
  }
  if (stored.power5?.length) {
    const su = sustainedEfforts(stored.power5, ftp);
    if (su.length) {
      out.sustained = {
        n: su.length,
        meanW: mean(su.map((e) => e.avgW)),
        firstW: su[0].avgW,
        lastW: su[su.length - 1].avgW,
        totalMin: su.reduce((s, e) => s + e.durSec, 0) / 60,
      };
    }
  }
  return out;
}

/** Reparto por tercios: potencia media (incluye paradas) y FC (ponderada por vuelta). Solo salidas de 90 min o más. */
export function thirds(power5: number[] | undefined, laps: Lap[]): { w: number[]; hr: (number | null)[] } | null {
  if (!power5 || power5.length * 5 < 90 * 60) return null;
  const n = power5.length;
  const w = [0, 1, 2].map((i) => Math.round(mean(power5.slice(Math.floor((n * i) / 3), Math.floor((n * (i + 1)) / 3)))));
  const total = laps.reduce((s, l) => s + l.durSec, 0);
  const hr: (number | null)[] = [null, null, null];
  if (total > 0) {
    const acc = [0, 0, 0], dur = [0, 0, 0];
    let t = 0;
    for (const l of laps) {
      const mid = t + l.durSec / 2;
      const i = Math.min(2, Math.floor((mid / total) * 3));
      if (l.avgHr != null) { acc[i] += l.avgHr * l.durSec; dur[i] += l.durSec; }
      t += l.durSec;
    }
    for (let i = 0; i < 3; i++) hr[i] = dur[i] > 0 ? Math.round(acc[i] / dur[i]) : null;
  }
  return { w, hr };
}

export interface PriorSession { date: string; ifr: number | null; tss: number | null; decoupling: number | null; ef: number | null; stats: EffortStats }

/** Líneas de comparación contra sesiones anteriores del mismo tipo (las más recientes primero). */
export function compareWithPrior(cur: { ifr: number | null; tss: number | null; decoupling: number | null; ef: number | null; stats: EffortStats }, priors: PriorSession[]): string[] {
  if (!priors.length) return [];
  const lines: string[] = [];
  const pm = (get: (p: PriorSession) => number | null) => {
    const v = priors.map(get).filter((x): x is number => x != null);
    return v.length ? mean(v) : null;
  };
  lines.push(`Sesiones anteriores del mismo tipo (${priors.length}): ${priors.map((p) => `${p.date}${p.tss != null ? ` TSS ${Math.round(p.tss)}` : ""}${p.stats.short ? `, ${p.stats.short.n} esfuerzos cortos a ${Math.round(p.stats.short.meanW)} W de media` : ""}${p.stats.sustained ? `, ${p.stats.sustained.n} tramos sostenidos a ${Math.round(p.stats.sustained.meanW)} W` : ""}${p.decoupling != null ? `, desacople ${ar(p.decoupling, 1)}%` : ""}`).join(" | ")}.`);
  const sh = pm((p) => p.stats.short?.meanW ?? null);
  if (cur.stats.short && sh) lines.push(`Esfuerzos cortos hoy vs esas sesiones: ${Math.round(cur.stats.short.meanW)} W de media vs ${Math.round(sh)} W (${sgn(((cur.stats.short.meanW - sh) / sh) * 100)}%).`);
  const su = pm((p) => p.stats.sustained?.meanW ?? null);
  if (cur.stats.sustained && su) lines.push(`Tramos sostenidos hoy vs esas sesiones: ${Math.round(cur.stats.sustained.meanW)} W de media vs ${Math.round(su)} W (${sgn(((cur.stats.sustained.meanW - su) / su) * 100)}%).`);
  const ef = pm((p) => p.ef);
  if (cur.ef != null && ef) lines.push(`Eficiencia aeróbica (NP/FC media) hoy ${ar(cur.ef, 2)} vs ${ar(ef, 2)} en esas sesiones (${sgn(((cur.ef - ef) / ef) * 100)}%). Es un indicador grueso: depende de calor, hidratación y descanso.`);
  const dc = pm((p) => p.decoupling);
  if (cur.decoupling != null && dc != null) lines.push(`Desacople hoy ${ar(cur.decoupling, 1)}% vs ${ar(dc, 1)}% de media en esas sesiones.`);
  return lines;
}

export function weekLoadLine(last7: number, prev7: number): string | null {
  if (!(prev7 > 0) && !(last7 > 0)) return null;
  const rel = prev7 > 0 ? ` (${sgn(((last7 - prev7) / prev7) * 100, 0)}% vs los 7 días anteriores: ${Math.round(prev7)})` : "";
  return `Carga de los últimos 7 días (con esta sesión): TSS ${Math.round(last7)}${rel}.`;
}

const RACE_NAME = /gran\s*fondo|fondo|carrera|race|competencia|crit|contrarreloj|\bcrono\b|prueba/i;

interface ActivityForInsights {
  id: string;
  athleteId: string;
  type: string;
  name: string | null;
  date: Date;
  durationSec: number;
  tss: number | null;
  intensityFactor: number | null;
  normalizedPower: number | null;
  avgHr: number | null;
  decouplingPct: number | null;
  rawStreamsJson: unknown;
}

const ifOf = (v: number | null) => (v == null ? null : v > 3 ? v / 100 : v);

/** Bloque de texto "HALLAZGOS CALCULADOS" para el análisis; "" si no hay nada útil. */
export async function buildSessionInsights(a: ActivityForInsights, ftp: number | null | undefined, stored: StoredLaps | null): Promise<string> {
  const lines: string[] = [];
  const f = ftp ?? 0;
  const stats = effortStats(stored, f);

  // Caída dentro de la sesión
  if (stats.short) {
    const d = ((stats.short.lastThirdW - stats.short.firstThirdW) / stats.short.firstThirdW) * 100;
    lines.push(`Esfuerzos cortos: ${stats.short.n}, media ${Math.round(stats.short.meanW)} W. Primer tercio ${Math.round(stats.short.firstThirdW)} W → último tercio ${Math.round(stats.short.lastThirdW)} W (${sgn(d)}%).`);
  }
  if (stats.sustained && stats.sustained.n >= 2) {
    const d = ((stats.sustained.lastW - stats.sustained.firstW) / stats.sustained.firstW) * 100;
    lines.push(`Tramos sostenidos: primero ${Math.round(stats.sustained.firstW)} W → último ${Math.round(stats.sustained.lastW)} W (${sgn(d)}%).`);
  }
  const th = thirds(stored?.power5, stored?.laps ?? []);
  if (th) {
    lines.push(`Reparto por tercios de la salida (potencia media incluyendo paradas${th.hr.some((x) => x != null) ? " / FC media" : ""}): ${th.w.map((w, i) => `${i + 1}º ${w} W${th.hr[i] != null ? ` / ${th.hr[i]} lpm` : ""}`).join("; ")}.`);
  }

  // Comparación con sesiones anteriores del mismo tipo (solo con datos ya guardados: no se baja nada nuevo)
  const kind = classifyStimulusType({ type: a.type, name: a.name, intensityFactor: a.intensityFactor, rawStreamsJson: a.rawStreamsJson });
  const since = new Date(a.date.getTime() - 120 * 86400000);
  const cands = await prisma.activity.findMany({
    where: { athleteId: a.athleteId, id: { not: a.id }, type: a.type, date: { lt: a.date, gte: since } },
    orderBy: { date: "desc" },
    take: 40,
    select: { date: true, name: true, tss: true, intensityFactor: true, normalizedPower: true, avgHr: true, decouplingPct: true, rawStreamsJson: true, lapsJson: true, durationSec: true },
  });
  const priors: PriorSession[] = cands
    .filter((c) => classifyStimulusType({ type: a.type, name: c.name, intensityFactor: c.intensityFactor, rawStreamsJson: c.rawStreamsJson }) === kind)
    .filter((c) => c.durationSec >= a.durationSec * 0.5 && c.durationSec <= a.durationSec * 1.8)
    .slice(0, 3)
    .map((c) => ({
      date: dateKeyLocal(c.date),
      ifr: ifOf(c.intensityFactor),
      tss: c.tss,
      decoupling: c.decouplingPct,
      ef: c.normalizedPower && c.avgHr ? c.normalizedPower / c.avgHr : null,
      stats: effortStats(c.lapsJson as unknown as StoredLaps | null, f),
    }));
  lines.push(...compareWithPrior({ ifr: ifOf(a.intensityFactor), tss: a.tss, decoupling: a.decouplingPct, ef: a.normalizedPower && a.avgHr ? a.normalizedPower / a.avgHr : null, stats }, priors));

  // Carga de la semana
  const end = new Date(a.date.getTime() + 12 * 3600 * 1000);
  const w = await prisma.activity.findMany({ where: { athleteId: a.athleteId, date: { gte: new Date(end.getTime() - 14 * 86400000), lte: end } }, select: { date: true, tss: true } });
  const cut = end.getTime() - 7 * 86400000;
  const last7 = w.filter((x) => x.date.getTime() > cut).reduce((s, x) => s + (x.tss ?? 0), 0);
  const prev7 = w.filter((x) => x.date.getTime() <= cut).reduce((s, x) => s + (x.tss ?? 0), 0);
  const wl = weekLoadLine(last7, prev7);
  if (wl) lines.push(wl);

  // ¿Fue una competencia?
  const day = dateKeyLocal(a.date);
  const goals = await prisma.athleteGoal.findMany({ where: { athleteId: a.athleteId, goalType: "EVENT", eventDate: { not: null } }, select: { name: true, eventDate: true, priority: true } });
  const race = goals.find((g) => g.eventDate && dateKeyLocal(g.eventDate) === day);
  if (race) lines.unshift(`ES UNA COMPETENCIA: «${race.name}» (prioridad ${race.priority}), el objetivo cargado para ese día. Analizala como carrera: reparto del esfuerzo, final de la prueba y recuperación posterior, no como un entrenamiento.`);
  else if (a.name && RACE_NAME.test(a.name) && a.durationSec >= 3600 && (ifOf(a.intensityFactor) ?? 0) >= 0.75) lines.unshift(`El nombre de la actividad sugiere una prueba o carrera («${a.name}»), sin objetivo cargado para ese día: si el contexto lo confirma, analizala como competencia.`);

  if (!lines.length) return "";
  return `HALLAZGOS CALCULADOS EN CÓDIGO (ya verificados; usalos tal cual para interpretar, no los recalcules; son descriptivos, no diagnósticos):\n${lines.map((l) => `- ${l}`).join("\n")}`;
}
