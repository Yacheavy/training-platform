import { dayKeyDate } from "../tz";
import { prisma } from "@/lib/prisma";
import { hrvSignal, restingHrSignal, type SignalMethod } from "./recovery-signals";
import { evaluateAvailability, scoreAvailability, type ScoreResult } from "./availability-score";

export interface AvailabilityResult {
  status: "GREEN" | "AMBER" | "RED";
  /** Puntaje 0–100 dentro de la banda del semáforo (heurística de práctica). */
  score: number;
  scoreDetail: ScoreResult;
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

  // Última fila con CTL y ATL (una fila de hoy que solo trae HRV no debe borrar la forma)
  const latest = await prisma.wellness.findFirst({
    where: { athleteId, date: { lte: dayKeyDate(new Date()) }, ctl: { not: null }, atl: { not: null } },
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

  const ev = evaluateAvailability({ hrvSig, rhrSig, checkin: checkinToday, tsb, minTsb });
  const { status, signalsTriggered } = ev;
  const reasons = [...ev.reasons];
  if (wellnessAgeDays != null && wellnessAgeDays >= 1) {
    reasons.push(`Último dato de HRV/FC de hace ${wellnessAgeDays} día${wellnessAgeDays === 1 ? "" : "s"} (todavía no sincronizó hoy)`);
  }
  const scoreDetail = scoreAvailability({ status, hrvDeltaPct, restingHrDeltaAbs, tsb, checkin: checkinToday });

  return {
    status,
    score: scoreDetail.score,
    scoreDetail,
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