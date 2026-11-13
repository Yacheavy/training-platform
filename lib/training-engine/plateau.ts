/**
 * Detector de estancamiento de carga (módulo puro y determinista).
 *
 * Qué mira: la CTL (fitness) al empezar cada día, agrupada en semanas, durante las últimas 8 semanas. Si el cambio neto es
 * muy chico (±PLATEAU_MAX_CHANGE puntos de CTL en 8 semanas, ~0,5 por semana), la carga está plana.
 *
 * Qué NO es: un diagnóstico. Sale de un principio general (sin aumento de la carga o del estímulo, la adaptación se frena:
 * sobrecarga progresiva); los umbrales son criterio práctico de diseño, no valores validados en ensayos. No usa el FTP para decidir
 * porque no hay historial de FTP: solo avisa si el FTP lleva mucho sin actualizarse.
 */
export const PLATEAU_WEEKS = 8;
export const PLATEAU_MAX_CHANGE = 4;
/** Con una carga plana y una prueba importante cerca no se avisa: afinar (taper) es justamente mantener o bajar. */
export const PLATEAU_GOAL_QUIET_DAYS = 21;
const MIN_DAYS_PER_WEEK = 4;

export interface LoadDay { date: Date; ctl: number }

export interface PlateauInput {
  /** CTL al empezar cada día (cualquier orden). */
  days: LoadDay[];
  /** Último día (hoy) de la ventana. */
  today: Date;
  /** TSS semanal promedio de la ventana (opcional, para el texto). */
  avgWeeklyTss?: number | null;
  /** Días hasta la próxima prueba A o B (null si no hay). */
  daysToNextGoal: number | null;
  /** Semanas desde la última actualización del FTP (null si se desconoce). */
  ftpStaleWeeks: number | null;
  /** Límite de subida de CTL por semana del atleta. */
  maxCtlRampPerWeek: number;
}

export interface PlateauResult {
  status: "flat" | "none" | "insufficient" | "quiet";
  /** Media semanal de CTL, de la más vieja a la más nueva. */
  weeklyCtl: number[];
  ctlFrom: number | null;
  ctlTo: number | null;
  change: number | null;
  weeks: number;
  avgWeeklyTss: number | null;
  ftpStaleWeeks: number | null;
  /** Subida semanal de CTL que se propone probar (nunca más que el límite del atleta). */
  suggestedRamp: number | null;
  /** Por qué no se evaluó o no se avisó (para los chequeos y la pantalla). */
  note: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function detectPlateau(i: PlateauInput): PlateauResult {
  const base: PlateauResult = { status: "insufficient", weeklyCtl: [], ctlFrom: null, ctlTo: null, change: null, weeks: PLATEAU_WEEKS, avgWeeklyTss: i.avgWeeklyTss ?? null, ftpStaleWeeks: i.ftpStaleWeeks, suggestedRamp: null, note: "" };
  const end = Date.UTC(i.today.getUTCFullYear(), i.today.getUTCMonth(), i.today.getUTCDate());
  const weekly: number[] = [];
  for (let w = PLATEAU_WEEKS - 1; w >= 0; w--) {
    const to = end - w * 7 * DAY_MS; // exclusivo
    const from = to - 7 * DAY_MS;
    const vals = i.days.filter((d) => d.date.getTime() >= from && d.date.getTime() < to).map((d) => d.ctl);
    if (vals.length < MIN_DAYS_PER_WEEK) return { ...base, note: "Todavía no hay 8 semanas de datos de carga para evaluar." };
    weekly.push(vals.reduce((s, v) => s + v, 0) / vals.length);
  }
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const ctlFrom = r1(weekly[0]);
  const ctlTo = r1(weekly[weekly.length - 1]);
  const change = r1(weekly[weekly.length - 1] - weekly[0]);
  const out: PlateauResult = { ...base, weeklyCtl: weekly.map(r1), ctlFrom, ctlTo, change };

  if (Math.abs(change) > PLATEAU_MAX_CHANGE) return { ...out, status: "none", note: "La carga se está moviendo." };
  if (i.daysToNextGoal != null && i.daysToNextGoal >= 0 && i.daysToNextGoal <= PLATEAU_GOAL_QUIET_DAYS) {
    return { ...out, status: "quiet", note: "Hay una prueba cerca: mantener la carga es parte del plan." };
  }
  // Se propone una subida suave: la mitad del límite del atleta (nunca más que el límite), con un piso de 1 por semana
  const ramp = Math.max(1, Math.min(i.maxCtlRampPerWeek, Math.round((i.maxCtlRampPerWeek / 2) * 10) / 10));
  return { ...out, status: "flat", suggestedRamp: Math.min(ramp, i.maxCtlRampPerWeek), note: "Carga plana durante 8 semanas." };
}
