import type { PlannedDay } from "./plan-builder";
import { MIN_GAP_DAYS_BETWEEN_VO2MAX } from "./quality-assignment";

/**
 * Invariantes que TODO plan generado debe cumplir. Devuelve la lista de
 * advertencias (vacía = plan consistente). No lanza: el generador las
 * devuelve al usuario y los chequeos automáticos fallan si hay alguna.
 */
const VO2_STIMULI = new Set(["hiit_genuino", "ronnestad_30_15", "billat_30_30", "rst"]);
const HARD_STIMULI = new Set([...VO2_STIMULI, "ftp_test", "ftp_test_5min", "ftp_test_8min"]);
const DAY_MS = 24 * 60 * 60 * 1000;

const isCoolType = (t: string) => t.startsWith("cooldown");
const isWarmType = (t: string) => t.startsWith("warmup");

export function validatePlan(plan: PlannedDay[], ctx: { objective: string; ftp: number; pvo2maxWatts?: number | null }): string[] {
  const w: string[] = [];
  const label = (d: PlannedDay) => `${d.date.toISOString().slice(0, 10)} (${d.stimulusType})`;

  // Por semana
  const weeks = new Map<number, PlannedDay[]>();
  for (const d of plan) weeks.set(d.weekIndex, [...(weeks.get(d.weekIndex) ?? []), d]);

  for (const [wk, days] of weeks) {
    const hiit = days.filter((d) => d.stimulusType === "hiit_genuino");
    if (hiit.length > 1) w.push(`Semana ${wk + 1}: ${hiit.length} sesiones HIIT (máx. 1)`);
    const ron = days.filter((d) => d.stimulusType === "ronnestad_30_15");
    if (ron.length > 1) w.push(`Semana ${wk + 1}: ${ron.length} sesiones Rønnestad (máx. 1)`);
    const spr = days.filter((d) => d.stimulusType === "z2_sprints");
    if (spr.length > 1) w.push(`Semana ${wk + 1}: ${spr.length} rodajes con sprints (máx. 1)`);
    // Un solo VO2max por semana (el segundo estímulo es de baja fatiga)
    const vo2 = days.filter((d) => VO2_STIMULI.has(d.stimulusType) && !d.isDeload);
    if (ctx.objective === "vo2max" && vo2.length > 1) w.push(`Semana ${wk + 1}: ${vo2.length} sesiones de VO2max (máx. 1 por semana)`);

    // Tiempo de Z2 mayoritario sobre el tiempo de ciclismo (modelo 80/20)
    const cyc = days.filter((d) => d.stimulusType !== "gym");
    const total = cyc.reduce((s, d) => s + d.blocks.reduce((a, b) => a + b.durationSec, 0), 0);
    const hard = cyc
      .filter((d) => HARD_STIMULI.has(d.stimulusType))
      .reduce((s, d) => s + d.blocks.filter((b) => b.type === "interval" || b.type.startsWith("test")).reduce((a, b) => a + b.durationSec, 0), 0);
    if (total > 0 && hard / total > 0.2) w.push(`Semana ${wk + 1}: ${Math.round((hard / total) * 100)}% del tiempo en intensidad alta (>20%)`);
  }

  // Separación entre sesiones duras (circular no aplica entre semanas: usa fechas reales)
  const hardDays = plan.filter((d) => VO2_STIMULI.has(d.stimulusType)).sort((a, b) => a.date.getTime() - b.date.getTime());
  for (let i = 1; i < hardDays.length; i++) {
    const gap = Math.round((hardDays[i].date.getTime() - hardDays[i - 1].date.getTime()) / DAY_MS);
    if (gap < MIN_GAP_DAYS_BETWEEN_VO2MAX) w.push(`${label(hardDays[i - 1])} → ${label(hardDays[i])}: solo ${gap} día(s) entre sesiones VO2max (mín. ${MIN_GAP_DAYS_BETWEEN_VO2MAX})`);
  }

  // Por sesión
  for (const d of plan) {
    if (d.stimulusType === "gym") continue;
    const dur = d.blocks.reduce((s, b) => s + b.durationSec, 0);
    if (dur <= 0) { w.push(`${label(d)}: sesión vacía`); continue; }
    if (dur > 6 * 3600 + 1) w.push(`${label(d)}: duración ${Math.round(dur / 60)} min excede 6 h`);

    const isHard = HARD_STIMULI.has(d.stimulusType);
    if (isHard) {
      const first = d.blocks.findIndex((b) => !isWarmType(b.type));
      const warmSec = d.blocks.slice(0, Math.max(first, 0)).reduce((s, b) => s + b.durationSec, 0);
      if (!d.blocks.some((b) => isWarmType(b.type))) w.push(`${label(d)}: sin calentamiento`);
      else if (warmSec < 600) w.push(`${label(d)}: calentamiento de ${Math.round(warmSec / 60)} min (<10)`);
      if (!d.blocks.some((b) => isCoolType(b.type))) w.push(`${label(d)}: sin vuelta a la calma`);
      const lastIdx = d.blocks.map((b) => b.type).lastIndexOf("interval");
      const coolIdx = d.blocks.findIndex((b) => isCoolType(b.type));
      if (coolIdx >= 0 && lastIdx > coolIdx) w.push(`${label(d)}: intervalos después de la vuelta a la calma`);
      if (d.blocks.some((b) => b.type === "z2_fill") && coolIdx >= 0 && d.blocks.findIndex((b) => b.type === "z2_fill") > coolIdx)
        w.push(`${label(d)}: relleno Z2 después de la vuelta a la calma`);
    }

    const reps = d.blocks.filter((b) => b.type === "interval").length;
    if (VO2_STIMULI.has(d.stimulusType)) {
      // Invariantes del libro (Chicharro & Vicente-Campos 2018) para todo HIIT
      const coolSec = d.blocks.filter((b) => isCoolType(b.type)).reduce((s, b) => s + b.durationSec, 0);
      if (coolSec < 900) w.push(`${label(d)}: vuelta a la calma de ${Math.round(coolSec / 60)} min (<15)`);
      const vt1 = ctx.ftp * 0.72;
      const coolMax = Math.max(0, ...d.blocks.filter((b) => isCoolType(b.type)).map((b) => b.targetWatts));
      if (coolMax > vt1 * 0.8 + 1) w.push(`${label(d)}: vuelta a la calma a ${coolMax} W (> 80% del VT1 = ${Math.round(vt1 * 0.8)} W)`);
      const wu = d.blocks.filter((b) => isWarmType(b.type));
      if (wu.length && Math.abs(wu[0].targetWatts - vt1) > 2) w.push(`${label(d)}: calentamiento a ${wu[0].targetWatts} W (esperado ~VT1 = ${Math.round(vt1)} W)`);
      if (wu.filter((b) => b.type === "warmup_activation").length !== 2) w.push(`${label(d)}: el calentamiento debe llevar 2 activaciones de 1 min`);
      const ivs = d.blocks.filter((b) => b.type === "interval");
      const recs = d.blocks.filter((b) => b.type === "recovery" && b.targetWatts < ivs[0]?.targetWatts);
      if (ctx.pvo2maxWatts && d.stimulusType !== "rst") {
        const ratio = recs.length && ivs.length ? recs[0].targetWatts / ivs[0].targetWatts : 0.5;
        if (Math.abs(ratio - 0.5) > 0.02 && d.stimulusType !== "billat_30_30") w.push(`${label(d)}: recuperación al ${Math.round(ratio * 100)}% del intervalo (esperado ~50%)`);
      }
    }
    if (d.stimulusType === "hiit_genuino") {
      // En deload/taper la sesión de mantenimiento lleva la mitad de repeticiones (mín. 3)
      const minReps = d.isDeload || d.rationale.includes("TAPER") ? 3 : 7;
      if (reps < minReps || reps > 10) w.push(`${label(d)}: ${reps} repeticiones (esperado ${minReps}–10)`);
      const longestInt = Math.max(...d.blocks.filter((b) => b.type === "interval").map((b) => b.durationSec));
      if (longestInt > 5 * 60) w.push(`${label(d)}: intervalo de ${Math.round(longestInt / 60)} min (>5)`);
    }
    if (d.stimulusType === "z2_sprints") {
      const sprints = d.blocks.filter((b) => b.type === "interval");
      if (![3, 5, 7, 9].includes(sprints.length)) w.push(`${label(d)}: ${sprints.length} sprints (esperado 3, 5, 7 o 9)`);
      if (sprints.some((b) => b.durationSec !== 30)) w.push(`${label(d)}: los sprints deben durar 30 s`);
      if (d.isDeload && sprints.length > 3) w.push(`${label(d)}: en descarga el rodaje con sprints lleva 3 sprints`);
      const sprintSec = sprints.reduce((s, b) => s + b.durationSec, 0);
      const totalSec = d.blocks.reduce((s, b) => s + b.durationSec, 0);
      if (totalSec > 0 && sprintSec / totalSec > 0.05) w.push(`${label(d)}: demasiado tiempo de sprint (${Math.round((sprintSec / totalSec) * 100)}%)`);
    }
    if (d.stimulusType === "ronnestad_30_15") {
      if (reps % 13 !== 0 || reps === 0 || reps > 39) w.push(`${label(d)}: ${reps} intervalos (debe ser 13×series, máx. 39)`);
      const maxW = Math.max(...d.blocks.filter((b) => b.type === "interval").map((b) => b.targetWatts));
      if (maxW > ctx.ftp * 1.4) w.push(`${label(d)}: intensidad ${maxW} W > 140% FTP`);
    }
    if (VO2_STIMULI.has(d.stimulusType)) {
      const maxW = Math.max(0, ...d.blocks.filter((b) => b.type === "interval").map((b) => b.targetWatts));
      if (maxW && maxW < ctx.ftp) w.push(`${label(d)}: intervalos por debajo del FTP (${maxW} W)`);
    }
    // Informativo: el protocolo manda sobre el tiempo del slot, pero conviene avisarlo
    if (d.slotTargetMin && VO2_STIMULI.has(d.stimulusType) && dur / 60 > d.slotTargetMin * 1.25) {
      w.push(`INFO: ${label(d)}: el protocolo dura ${Math.round(dur / 60)} min vs ${d.slotTargetMin} min del slot (+${Math.round((dur / 60 / d.slotTargetMin - 1) * 100)}%)`);
    }
    if (!Number.isFinite(d.tss) || d.tss < 0 || d.tss > 400) w.push(`${label(d)}: TSS fuera de rango (${d.tss})`);
  }

  // Informativo: velocidad de subida de la carga semanal (TSS) entre semanas de carga consecutivas.
  // Referencia de práctica: rampas de CTL de ~5–8/semana son habituales; más es riesgoso (heurística).
  const weekTss = [...weeks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([wk, days]) => ({ wk, tss: days.reduce((s, d) => s + d.tss, 0), deload: days.some((d) => d.isDeload) }));
  for (let i = 1; i < weekTss.length; i++) {
    const prev = weekTss[i - 1];
    const cur = weekTss[i];
    if (prev.deload || cur.deload || prev.tss <= 0) continue;
    const inc = (cur.tss - prev.tss) / prev.tss;
    if (inc > 0.2) w.push(`INFO: semana ${cur.wk + 1}: la carga semanal sube ${Math.round(inc * 100)}% vs la anterior (TSS ${prev.tss}→${cur.tss})`);
  }

  // Deload: como máximo UNA sesión de VO2max (de mantenimiento) por semana
  for (const [wk, days] of weeks) {
    const n = days.filter((d) => d.isDeload && VO2_STIMULI.has(d.stimulusType)).length;
    if (n > 1) w.push(`Semana ${wk + 1} (deload): ${n} sesiones de VO2max (máx. 1 de mantenimiento)`);
  }

  return w;
}
