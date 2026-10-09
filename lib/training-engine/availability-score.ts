import { hrvSignal, restingHrSignal, type DailyPoint, type SignalResult } from "./recovery-signals";

/**
 * Disponibilidad: semáforo + puntaje de una misma fuente.
 *
 * El SEMÁFORO es la autoridad (fusión de HRV + FC de reposo + bienestar subjetivo en ciclistas, Alfonso, Clarke & Capdevila 2025;
 * las 4 dimensiones de Hooper-Mackinnon 1995; exigir coincidencia de 2+ señales para rojo es criterio de diseño; las 4 preguntas del check-in cuentan como UNA señal, o como dos si 3 o más están en alerta). El PUNTAJE (0–100)
 * es una heurística de práctica, no un puntaje validado: parte de una base por estado y se mueve dentro de la banda de ese estado
 * según cuánto se desvían HRV, FC de reposo, forma (TSB) y check-in. Así nunca contradice al semáforo:
 *   Rojo 15–49 · Moderada (ámbar) 50–74 · Alta (verde) 75–100.
 */
export type AvailabilityStatus = "GREEN" | "AMBER" | "RED";

export interface CheckinInput {
  fatigue: number | null;
  stress: number | null;
  muscleSoreness: number | null;
  sleepQuality: number | null;
}

export interface EvaluationInput {
  hrvSig: SignalResult;
  rhrSig: SignalResult;
  checkin: CheckinInput | null;
  tsb: number | null;
  minTsb: number;
}

export interface Evaluation {
  status: AvailabilityStatus;
  signalsTriggered: string[];
  reasons: string[];
}

/** Reglas del semáforo (extraídas tal cual de calculateAvailability para poder usarlas también en el historial). */
export function evaluateAvailability(i: EvaluationInput): Evaluation {
  const signalsTriggered: string[] = [];
  const reasons: string[] = [];
  const { hrvSig, rhrSig, checkin, tsb, minTsb } = i;

  if (hrvSig.triggered) {
    signalsTriggered.push("hrv");
    if (hrvSig.reason) reasons.push(hrvSig.reason);
  } else if (hrvSig.method === "insufficient") {
    reasons.push("HRV: datos insuficientes para evaluar (se necesitan al menos 4 de los últimos 7 días)");
  }
  if (rhrSig.triggered) {
    signalsTriggered.push("resting_hr");
    if (rhrSig.reason) reasons.push(rhrSig.reason);
  }
  if (checkin) {
    if ((checkin.fatigue ?? 0) >= 6) {
      signalsTriggered.push("fatigue");
      reasons.push(`Fatiga reportada ${checkin.fatigue === 7 ? "muy alta" : "elevada"} hoy (${checkin.fatigue}/7)`);
    }
    if ((checkin.stress ?? 0) >= 6) {
      signalsTriggered.push("stress");
      reasons.push(`Estrés reportado ${checkin.stress === 7 ? "muy alto" : "elevado"} hoy (${checkin.stress}/7)`);
    }
    if ((checkin.muscleSoreness ?? 0) >= 6) {
      signalsTriggered.push("muscle_soreness");
      reasons.push(`Dolor muscular reportado ${checkin.muscleSoreness === 7 ? "muy alto" : "elevado"} hoy (${checkin.muscleSoreness}/7)`);
    }
    if ((checkin.sleepQuality ?? 8) <= 2) {
      signalsTriggered.push("sleep_quality");
      reasons.push(`Calidad de sueño reportada muy baja hoy (${checkin.sleepQuality}/7)`);
    }
  }

  // TSB: señal de CARGA acumulada; por sí solo solo da ámbar. Rojo exige TSB bajo + 1 señal de recuperación, o 2+ señales.
  const tsbAlert = tsb != null && tsb < minTsb;
  if (tsbAlert) reasons.push(`TSB en ${tsb!.toFixed(1)}, por debajo de tu mínimo configurado (${minTsb})`);

  // Las 4 preguntas del check-in se mueven juntas (una mala noche las altera a la vez): cuentan como UNA señal, y como dos solo si
  // el cuadro es claro (3 o 4 de las 4 en alerta). Criterio de diseño, no un umbral validado en ensayos.
  const SUBJECTIVE = new Set(["fatigue", "stress", "muscle_soreness", "sleep_quality"]);
  const subjectiveHits = signalsTriggered.filter((s) => SUBJECTIVE.has(s)).length;
  const subjectiveWeight = subjectiveHits === 0 ? 0 : subjectiveHits >= 3 ? 2 : 1;
  if (subjectiveHits === 2) reasons.push("Las respuestas del check-in cuentan como una sola señal (se mueven juntas); con 3 o más en alerta pesan como dos");
  const n = signalsTriggered.length - subjectiveHits + subjectiveWeight;
  const status: AvailabilityStatus = n >= 2 || (tsbAlert && n >= 1) ? "RED" : n === 1 || tsbAlert ? "AMBER" : "GREEN";
  if (reasons.length === 0) reasons.push("Sin señales de alerta en HRV, FC reposo, check-in o TSB");
  return { status, signalsTriggered, reasons };
}

export const SCORE_BANDS: Record<AvailabilityStatus, { lo: number; hi: number; base: number }> = {
  RED: { lo: 15, hi: 49, base: 35 },
  AMBER: { lo: 50, hi: 74, base: 62 },
  GREEN: { lo: 75, hi: 100, base: 85 },
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface ScoreInput {
  status: AvailabilityStatus;
  /** Cambio de la media móvil de HRV vs línea base (%). */
  hrvDeltaPct: number | null;
  /** Diferencia de FC de reposo vs línea base (lpm; positivo = más alta = peor). */
  restingHrDeltaAbs: number | null;
  tsb: number | null;
  checkin: CheckinInput | null;
}

export interface ScoreResult {
  score: number;
  /** Aporte de cada componente a la base (puntos; 0 si faltó el dato). */
  parts: { hrv: number; restingHr: number; tsb: number; checkin: number };
  /** Componentes que no se pudieron usar (para decirlo en pantalla). */
  missing: string[];
}

/** Puntaje 0–100 dentro de la banda del semáforo. Heurística de práctica (los pesos no están validados en ensayos). */
export function scoreAvailability(i: ScoreInput): ScoreResult {
  const missing: string[] = [];
  const hrv = i.hrvDeltaPct == null ? 0 : clamp(i.hrvDeltaPct * 0.8, -8, 8);
  if (i.hrvDeltaPct == null) missing.push("HRV");
  const rhr = i.restingHrDeltaAbs == null ? 0 : clamp(-i.restingHrDeltaAbs * 1.0, -4, 4);
  if (i.restingHrDeltaAbs == null) missing.push("FC de reposo");
  // TSB: 0 es neutro; −30 resta 5; +10 suma 3
  const tsb = i.tsb == null ? 0 : i.tsb >= 0 ? clamp(i.tsb * 0.3, 0, 3) : clamp(i.tsb / 6, -5, 0);
  if (i.tsb == null) missing.push("forma (TSB)");
  let checkin = 0;
  const c = i.checkin;
  const dims = c && c.fatigue != null && c.stress != null && c.muscleSoreness != null && c.sleepQuality != null ? c : null;
  if (dims) {
    // bienestar 0..1 (1 = todo bien): fatiga, estrés y dolor (1–7, alto = mal) y sueño (1–7, alto = bien)
    const w = ((7 - dims.fatigue!) / 6 + (7 - dims.stress!) / 6 + (7 - dims.muscleSoreness!) / 6 + (dims.sleepQuality! - 1) / 6) / 4;
    checkin = clamp((w - 0.5) * 12, -6, 6);
  } else {
    missing.push("check-in");
  }
  const band = SCORE_BANDS[i.status];
  const score = Math.round(clamp(band.base + hrv + rhr + tsb + checkin, band.lo, band.hi));
  return { score, parts: { hrv, restingHr: rhr, tsb, checkin }, missing };
}

export interface HistoryDay {
  date: Date;
  hrv: number | null;
  restingHr: number | null;
  ctl: number | null;
  atl: number | null;
  checkin: CheckinInput | null;
}
export interface HistoryPoint {
  date: string;
  score: number;
  status: AvailabilityStatus;
  hasCheckin: boolean;
}

/**
 * Historial con EXACTAMENTE la misma lógica que el día de hoy: para cada día con dato de recuperación se evalúan las señales
 * con la ventana de datos disponible hasta ese día (sin mirar el futuro), se obtiene el semáforo y de ahí el puntaje.
 */
export function buildAvailabilityHistory(days: HistoryDay[], opts: { from: Date; to: Date; minTsb: number; hrvDropAlertPct: number }): HistoryPoint[] {
  const points: DailyPoint[] = days.map((d) => ({ date: d.date, hrv: d.hrv, restingHr: d.restingHr }));
  const out: HistoryPoint[] = [];
  for (const d of days) {
    if (d.date < opts.from || d.date > opts.to) continue;
    if (d.hrv == null && d.restingHr == null) continue;
    const upTo = points.filter((p) => p.date <= d.date);
    const hrvSig = hrvSignal(upTo, d.date, opts.hrvDropAlertPct);
    const rhrSig = restingHrSignal(upTo, d.date);
    // Sin ninguna señal evaluable no se inventa un puntaje
    if (hrvSig.method === "insufficient" && rhrSig.method === "insufficient") continue;
    const tsb = d.ctl != null && d.atl != null ? d.ctl - d.atl : null;
    const ev = evaluateAvailability({ hrvSig, rhrSig, checkin: d.checkin, tsb, minTsb: opts.minTsb });
    const s = scoreAvailability({ status: ev.status, hrvDeltaPct: hrvSig.delta, restingHrDeltaAbs: rhrSig.delta, tsb, checkin: d.checkin });
    out.push({ date: d.date.toISOString(), score: s.score, status: ev.status, hasCheckin: !!d.checkin });
  }
  return out;
}
