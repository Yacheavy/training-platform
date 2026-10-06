import { dayKeyDate } from "../tz";
import { prisma } from "@/lib/prisma";
import { hrvSignal, restingHrSignal, type SignalMethod } from "./recovery-signals";

export interface AvailabilityResult {
  status: "GREEN" | "AMBER" | "RED";
  hrvToday: number | null;
  hrvAvg7d: number | null;
  hrvDeltaPct: number | null;
  restingHrToday: number | null;
  restingHrAvg7d: number | null;
  restingHrDeltaAbs: number | null;
  tsb: number | null;
  checkinToday: { fatigue: number | null; stress: number | null; muscleSoreness: number | null; sleepQuality: number | null } | null;
  signalsTriggered: string[];
  reasons: string[];
  hrvMethod: SignalMethod;
  restingHrMethod: SignalMethod;
  /** Días desde el último dato de HRV/FC (0 = hoy). null si no hay datos. */
  wellnessAgeDays: number | null;
}

/**
 * Fusión de marcadores según Alfonso, Clarke & Capdevila (2025,
 * Scientific Reports): HRV + FC de reposo + bienestar subjetivo supera
 * a usar HRV aislado en ciclistas. Requiere coincidencia de 2+ señales
 * para escalar a RED — nunca una sola señal aislada (criterio de diseño inspirado en Meeusen et al. 2013; no es un umbral validado en ensayos).
 *
 * El bienestar subjetivo usa las 4 dimensiones originales de
 * Hooper-Mackinnon (1995): sueño, fatiga, estrés, dolor muscular.
 * El ánimo (5to campo del check-in) queda fuera de este cálculo —
 * no es parte de Hooper-Mackinnon, es una adición nuestra para dar
 * contexto cualitativo al chat, no para el semáforo duro.
 */
export async function calculateAvailability(athleteId: string): Promise<AvailabilityResult> {
  const thresholds = await prisma.athleteThresholds.findUnique({ where: { athleteId } });
  const hrvDropAlertPct = thresholds?.hrvDropAlertPct ?? 7.5;
  const minTsb = thresholds?.minTsb ?? -30;

  const latest = await prisma.wellness.findFirst({
    where: { athleteId, date: { lte: dayKeyDate(new Date()) } },
    orderBy: { date: "desc" },
  });

  const todayKey = dayKeyDate(new Date());
  // Último dato de RECUPERACIÓN (HRV o FC de reposo): una fila de hoy que solo trae CTL/ATL no cuenta
  const latestRecovery = await prisma.wellness.findFirst({
    where: { athleteId, date: { lte: todayKey }, OR: [{ hrv: { not: null } }, { restingHr: { not: null } }] },
    orderBy: { date: "desc" },
  });
  const history = await prisma.wellness.findMany({
    where: { athleteId, date: { gte: new Date(todayKey.getTime() - 61 * 24 * 60 * 60 * 1000), lte: todayKey } },
    select: { date: true, hrv: true, restingHr: true },
    orderBy: { date: "asc" },
  });
  const hrvSig = hrvSignal(history, todayKey, hrvDropAlertPct);
  const rhrSig = restingHrSignal(history, todayKey);

  const hrvToday = latestRecovery?.date.getTime() === todayKey.getTime() ? (latestRecovery?.hrv ?? null) : null;
  const hrvAvg7d = hrvSig.rolling7;
  const hrvDeltaPct = hrvSig.delta;
  const restingHrToday = latestRecovery?.date.getTime() === todayKey.getTime() ? (latestRecovery?.restingHr ?? null) : null;
  const restingHrAvg7d = rhrSig.rolling7;
  const restingHrDeltaAbs = rhrSig.delta;
  const wellnessAgeDays = latestRecovery ? Math.round((todayKey.getTime() - latestRecovery.date.getTime()) / (24 * 60 * 60 * 1000)) : null;

  const tsb = latest?.ctl != null && latest?.atl != null ? latest.ctl - latest.atl : null;

  const todayStart = dayKeyDate(new Date());
  const checkin = await prisma.dailyCheckin.findUnique({ where: { athleteId_date: { athleteId, date: todayStart } } });
  const checkinToday = checkin
    ? { fatigue: checkin.fatigue, stress: checkin.stress, muscleSoreness: checkin.muscleSoreness, sleepQuality: checkin.sleepQuality }
    : null;

  const signalsTriggered: string[] = [];
  const reasons: string[] = [];

  // Señal 1: HRV contra tu línea base individual (ver recovery-signals.ts)
  if (hrvSig.triggered) {
    signalsTriggered.push("hrv");
    if (hrvSig.reason) reasons.push(hrvSig.reason);
  } else if (hrvSig.method === "insufficient") {
    reasons.push("HRV: datos insuficientes para evaluar (se necesitan al menos 4 de los últimos 7 días)");
  }

  // Señal 2: FC de reposo — evidencia más débil que HRV; señal complementaria
  if (rhrSig.triggered) {
    signalsTriggered.push("resting_hr");
    if (rhrSig.reason) reasons.push(rhrSig.reason);
  }
  if (wellnessAgeDays != null && wellnessAgeDays >= 1) {
    reasons.push(`Último dato de HRV/FC de hace ${wellnessAgeDays} día${wellnessAgeDays === 1 ? "" : "s"} (todavía no sincronizó hoy)`);
  }

  // Señales 3-6: bienestar subjetivo (check-in), las 4 dimensiones de
  // Hooper-Mackinnon. Los cortes absolutos (≥6 / ≤2 sobre 7) son
  // un criterio práctico, no un valor publicado.
  if (checkinToday) {
    if ((checkinToday.fatigue ?? 0) >= 6) {
      signalsTriggered.push("fatigue");
      const level = checkinToday.fatigue === 7 ? "muy alta" : "elevada";
      reasons.push(`Fatiga reportada ${level} hoy (${checkinToday.fatigue}/7)`);
    }
    if ((checkinToday.stress ?? 0) >= 6) {
      signalsTriggered.push("stress");
      const level = checkinToday.stress === 7 ? "muy alto" : "elevado";
      reasons.push(`Estrés reportado ${level} hoy (${checkinToday.stress}/7)`);
    }
    if ((checkinToday.muscleSoreness ?? 0) >= 6) {
      signalsTriggered.push("muscle_soreness");
      const level = checkinToday.muscleSoreness === 7 ? "muy alto" : "elevado";
      reasons.push(`Dolor muscular reportado ${level} hoy (${checkinToday.muscleSoreness}/7)`);
    }
    if ((checkinToday.sleepQuality ?? 8) <= 2) {
      signalsTriggered.push("sleep_quality");
      reasons.push(`Calidad de sueño reportada muy baja hoy (${checkinToday.sleepQuality}/7)`);
    }
  }

  // TSB: señal de CARGA acumulada, no de recuperación del día. Un TSB bajo es normal en una fase
  // de construcción (Friel: −10 a −30 es la zona productiva); por sí solo solo da AMBER.
  // RED exige TSB bajo el mínimo MÁS al menos una señal de recuperación, o 2+ señales de recuperación.
  const tsbAlert = tsb != null && tsb < minTsb;
  if (tsbAlert) {
    reasons.push(`TSB en ${tsb!.toFixed(1)}, por debajo de tu mínimo configurado (${minTsb})`);
  }

  const recoverySignalCount = signalsTriggered.length;
  let status: AvailabilityResult["status"];
  if (recoverySignalCount >= 2 || (tsbAlert && recoverySignalCount >= 1)) {
    status = "RED";
  } else if (recoverySignalCount === 1 || tsbAlert) {
    status = "AMBER";
  } else {
    status = "GREEN";
  }

  if (reasons.length === 0) reasons.push("Sin señales de alerta en HRV, FC reposo, check-in o TSB");

  return {
    status,
    hrvToday,
    hrvAvg7d,
    hrvDeltaPct,
    restingHrToday,
    restingHrAvg7d,
    restingHrDeltaAbs,
    tsb,
    checkinToday,
    signalsTriggered,
    reasons,
    hrvMethod: hrvSig.method,
    restingHrMethod: rhrSig.method,
    wellnessAgeDays,
  };
}