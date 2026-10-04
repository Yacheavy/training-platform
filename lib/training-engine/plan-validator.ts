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

export function validatePlan(plan: PlannedDay[], ctx: { objective: string; ftp: number }): string[] {
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
    if (d.stimulusType === "hiit_genuino") {
      const step = Math.floor(d.weekIndex / 5);
      const expected = Math.min(10, 7 + 0); // el escalón sube duración/reps cada mesociclo
      if (reps < 7 || reps > 10) w.push(`${label(d)}: ${reps} repeticiones (esperado 7–10; base ${expected}, escalón ${step + 1})`);
      const longestInt = Math.max(...d.blocks.filter((b) => b.type === "interval").map((b) => b.durationSec));
      if (longestInt > 5 * 60) w.push(`${label(d)}: intervalo de ${Math.round(longestInt / 60)} min (>5)`);
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
    if (!Number.isFinite(d.tss) || d.tss < 0 || d.tss > 400) w.push(`${label(d)}: TSS fuera de rango (${d.tss})`);
  }

  // Deload sin calidad
  for (const d of plan) {
    if (d.isDeload && VO2_STIMULI.has(d.stimulusType)) w.push(`${label(d)}: sesión de VO2max en semana de deload`);
  }

  return w;
}
