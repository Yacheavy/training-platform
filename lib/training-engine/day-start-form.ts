/**
 * Forma (CTL, ATL, TSB) AL EMPEZAR EL DÍA = el cierre del día anterior.
 *
 * Por qué: el CTL/ATL que Intervals guarda para HOY ya incluye la carga de hoy: la sesión hecha, o si todavía no se hizo, la
 * PLANIFICADA (estimada, y los sprints la inflan). Si el semáforo usara ese valor, al cargar el HRV o el check-in a la mañana se
 * re-evaluaría la sesión de hoy con una fatiga que todavía no se acumuló (y que la propia sesión provoca). Para decidir cómo
 * entrenar hoy la forma correcta es la de ayer al cierre, la misma que ve el atleta al arrancar la jornada.
 *
 * Si el último dato de CTL/ATL anterior a hoy es muy viejo (más de MAX_AGE_DAYS), no se usa: mejor sin dato que con uno desactualizado.
 */
export const DAY_MS = 24 * 60 * 60 * 1000;
export const FORM_MAX_AGE_DAYS = 4;

export interface LoadRow { date: Date; ctl: number | null; atl: number | null }
export interface DayStartForm { date: Date; ctl: number; atl: number; tsb: number }

/** Última fila con CTL y ATL estrictamente anterior a `day` (clave de día a medianoche UTC) y no más vieja que FORM_MAX_AGE_DAYS. */
export function pickDayStartForm<T extends LoadRow>(rows: T[], day: Date): (DayStartForm & { row: T }) | null {
  let best: T | null = null;
  for (const r of rows) {
    if (r.ctl == null || r.atl == null) continue;
    if (r.date.getTime() >= day.getTime()) continue;
    if (!best || r.date.getTime() > best.date.getTime()) best = r;
  }
  if (!best) return null;
  if ((day.getTime() - best.date.getTime()) / DAY_MS > FORM_MAX_AGE_DAYS) return null;
  return { date: best.date, ctl: best.ctl!, atl: best.atl!, tsb: best.ctl! - best.atl!, row: best };
}

/**
 * Serie "al empezar cada día": el punto del día D lleva el cierre de D-1. Se emite un punto por cada fila (en su día siguiente)
 * hasta `lastDay` inclusive, así que "hoy" existe aunque Intervals todavía no haya creado la fila de hoy.
 */
export function dayStartSeries(rows: LoadRow[], lastDay: Date): { date: Date; ctl: number; atl: number; tsb: number }[] {
  const out: { date: Date; ctl: number; atl: number; tsb: number }[] = [];
  for (const r of [...rows].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    if (r.ctl == null || r.atl == null) continue;
    const d = new Date(r.date.getTime() + DAY_MS);
    if (d.getTime() > lastDay.getTime()) continue;
    out.push({ date: d, ctl: r.ctl, atl: r.atl, tsb: r.ctl - r.atl });
  }
  return out;
}
