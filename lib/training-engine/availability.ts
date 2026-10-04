import { dayKeyDate } from "../tz";
import { prisma } from "@/lib/prisma";

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
}

/**
 * Fusión de marcadores según Alfonso, Clarke & Capdevila (2025,
 * Scientific Reports): HRV + FC de reposo + bienestar subjetivo supera
 * a usar HRV aislado en ciclistas. Requiere coincidencia de 2+ señales
 * para escalar a RED — nunca una sola señal aislada (Meeusen et al. 2013).
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
  const minTsb = thresholds?.minTsb ?? -25;

  const latest = await prisma.wellness.findFirst({
    where: { athleteId },
    orderBy: { date: "desc" },
  });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = await prisma.wellness.findMany({
    where: { athleteId, date: { gte: sevenDaysAgo } },
    select: { hrv: true, restingHr: true },
  });

  const hrvValues = recent.map((w) => w.hrv).filter((v): v is number => v != null);
  const hrvAvg7d = hrvValues.length > 0 ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length : null;

  const rhrValues = recent.map((w) => w.restingHr).filter((v): v is number => v != null);
  const restingHrAvg7d = rhrValues.length > 0 ? rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length : null;

  const hrvToday = latest?.hrv ?? null;
  const hrvDeltaPct =
    hrvToday != null && hrvAvg7d != null && hrvAvg7d > 0 ? ((hrvToday - hrvAvg7d) / hrvAvg7d) * 100 : null;

  const restingHrToday = latest?.restingHr ?? null;
  const restingHrDeltaAbs =
    restingHrToday != null && restingHrAvg7d != null ? restingHrToday - restingHrAvg7d : null;

  const tsb = latest?.ctl != null && latest?.atl != null ? latest.ctl - latest.atl : null;

  const todayStart = dayKeyDate(new Date());
  const checkin = await prisma.dailyCheckin.findUnique({ where: { date: todayStart } });
  const checkinToday = checkin
    ? { fatigue: checkin.fatigue, stress: checkin.stress, muscleSoreness: checkin.muscleSoreness, sleepQuality: checkin.sleepQuality }
    : null;

  const signalsTriggered: string[] = [];
  const reasons: string[] = [];

  // Señal 1: HRV — umbral poblacional de referencia (TrainingPeaks/práctica
  // clínica). NOTA: el umbral individualizado correcto según Plews (2013) es
  // 0.5 × el coeficiente de variación personal del atleta, calculado sobre
  // su línea base — esto todavía no está implementado (requiere AthleteBaseline
  // calibrado con 4+ semanas de datos). Hasta entonces, este es un umbral
  // genérico de la literatura, no personalizado.
  if (hrvDeltaPct != null && hrvDeltaPct < -hrvDropAlertPct) {
    signalsTriggered.push("hrv");
    reasons.push(`HRV ${hrvDeltaPct.toFixed(1)}% bajo tu media de 7 días (umbral genérico: -${hrvDropAlertPct}%, no individualizado aún)`);
  }

  // Señal 2: FC de reposo — evidencia más débil que HRV (Alfonso et al. 2025
  // la incluye como señal complementaria, no principal). Umbral: +5bpm sobre
  // la media de 7 días.
  if (restingHrDeltaAbs != null && restingHrDeltaAbs >= 5) {
    signalsTriggered.push("resting_hr");
    reasons.push(`FC de reposo ${restingHrDeltaAbs.toFixed(1)}bpm sobre tu media de 7 días`);
  }

  // Señales 3-6: bienestar subjetivo (check-in), las 4 dimensiones de
  // Hooper-Mackinnon. El estrés es el ítem más consistente día a día
  // según Alfonso et al. 2025, pero las 4 son parte del cuestionario original.
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

  // TSB se trata como señal de carga complementaria, no parte de la fusión
  // de recuperación de Alfonso et al. (esa fusión es HRV+FCreposo+bienestar).
  // Se mantiene como corte duro aparte porque refleja algo distinto: carga
  // acumulada, no estado de recuperación del día.
  const tsbAlert = tsb != null && tsb < minTsb;
  if (tsbAlert) {
    reasons.push(`TSB en ${tsb!.toFixed(1)}, por debajo de tu mínimo configurado (${minTsb})`);
  }

  const recoverySignalCount = signalsTriggered.length;
  let status: AvailabilityResult["status"];
  if (tsbAlert || recoverySignalCount >= 2) {
    status = "RED";
  } else if (recoverySignalCount === 1) {
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
  };
}