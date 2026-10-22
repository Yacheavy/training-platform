/**
 * Prueba de la forma "al empezar el día" (cierre de ayer). Ejecutar: npx tsx lib/day-start-form-check.ts
 * Incluye el caso real que motivó el cambio: hoy Intervals suma la sesión planificada (sprints) y el TSB de hoy se infla.
 */
import { pickDayStartForm, dayStartSeries, DAY_MS, FORM_MAX_AGE_DAYS } from "./training-engine/day-start-form";
import { buildAvailabilityHistory } from "./training-engine/availability-score";

let fails = 0, n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log("FALLA:", m); } };
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const row = (s: string, ctl: number | null, atl: number | null) => ({ date: day(s), ctl, atl });

// Caso real (22/10): ayer 66.6/72.2; hoy la fila ya trae 84.9/175.2 por la carga planificada
const rows = [row("2026-10-20", 68.2, 81.5), row("2026-10-21", 66.6, 72.2), row("2026-10-22", 84.9, 175.2)];
const f = pickDayStartForm(rows, day("2026-10-22"))!;
ok(f.ctl === 66.6 && f.atl === 72.2 && Math.abs(f.tsb - -5.6) < 1e-9, "usa el cierre de ayer, no la fila de hoy");
ok(pickDayStartForm(rows, day("2026-10-23"))!.ctl === 84.9, "mañana, la fila de hoy pasa a ser el cierre de ayer");
ok(pickDayStartForm([row("2026-10-22", 1, 2)], day("2026-10-22")) === null, "solo hay fila de hoy: sin dato");
ok(pickDayStartForm([], day("2026-10-22")) === null, "sin filas: sin dato");
ok(pickDayStartForm([row("2026-10-21", null, 5), row("2026-10-20", 60, 70)], day("2026-10-22"))!.ctl === 60, "salta filas sin CTL/ATL");
ok(pickDayStartForm([row("2026-10-21", 50, null)], day("2026-10-22")) === null, "ATL nulo no sirve");
// Antigüedad
ok(pickDayStartForm([row("2026-10-18", 60, 70)], day("2026-10-22")) !== null, `dato de hace ${FORM_MAX_AGE_DAYS} días todavía sirve`);
ok(pickDayStartForm([row("2026-10-17", 60, 70)], day("2026-10-22")) === null, "dato de hace 5 días no se usa");
// Orden indistinto
ok(pickDayStartForm([...rows].reverse(), day("2026-10-22"))!.ctl === 66.6, "no depende del orden de las filas");

// Serie: el punto de D lleva el cierre de D-1, hasta hoy inclusive, aunque la fila de hoy no exista
const s = dayStartSeries([row("2026-10-20", 68.2, 81.5), row("2026-10-21", 66.6, 72.2)], day("2026-10-22"));
ok(s.length === 2 && s[1].date.getTime() === day("2026-10-22").getTime() && s[1].ctl === 66.6, "hoy existe en la serie con el cierre de ayer");
ok(s.every((p) => Math.abs(p.tsb - (p.ctl - p.atl)) < 1e-9), "TSB = CTL - ATL en cada punto");
const s2 = dayStartSeries(rows, day("2026-10-22"));
ok(dayStartSeries(rows, day("2026-10-22")).every((p) => p.date.getTime() <= day("2026-10-22").getTime()), "nunca pasa de hoy");
ok(!dayStartSeries(rows, day("2026-10-22")).some((p) => p.ctl === 84.9), "la fila de hoy (con la sesión planificada) no aparece hasta mañana");

// Historial del semáforo: cada día usa el cierre del día anterior
const days = [
  { date: day("2026-10-20"), hrv: 50, restingHr: 48, ctl: 68.2, atl: 81.5, checkin: null },
  { date: day("2026-10-21"), hrv: 50, restingHr: 48, ctl: 66.6, atl: 72.2, checkin: null },
  { date: day("2026-10-22"), hrv: 50, restingHr: 48, ctl: 84.9, atl: 175.2, checkin: null },
];
const h = buildAvailabilityHistory(days, { from: day("2026-10-20"), to: day("2026-10-22"), minTsb: -30, hrvDropAlertPct: 7.5 });
ok(h.every((p) => p.status !== "RED"), "con TSB de inicio de día normal el historial no se pone rojo por la sesión de hoy");

// Aleatorio: la forma de inicio nunca mira el futuro ni la fila de hoy
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let i = 0; i < 2000; i++) {
  const today = day("2026-10-22");
  const rs = Array.from({ length: 1 + Math.floor(rnd() * 8) }, () => row(new Date(today.getTime() - Math.floor(rnd() * 10 - 2) * DAY_MS).toISOString().slice(0, 10), rnd() < 0.2 ? null : 40 + rnd() * 60, rnd() < 0.2 ? null : 40 + rnd() * 100));
  const p = pickDayStartForm(rs, today);
  if (p) {
    ok(p.date.getTime() < today.getTime(), "nunca usa hoy ni el futuro");
    ok((today.getTime() - p.date.getTime()) / DAY_MS <= FORM_MAX_AGE_DAYS, "nunca usa un dato viejo");
    ok(!rs.some((r) => r.ctl != null && r.atl != null && r.date.getTime() < today.getTime() && r.date.getTime() > p.date.getTime()), "es la fila más reciente anterior a hoy");
  }
}
console.log(`${n} comprobaciones, ${fails} fallas`);
process.exit(fails ? 1 : 0);
