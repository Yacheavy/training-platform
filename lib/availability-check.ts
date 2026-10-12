/**
 * Chequeo del semáforo de disponibilidad (módulo puro, sin base de datos).
 * Ejecutar: npx tsx lib/availability-check.ts
 * Verifica: reglas del semáforo contra una implementación independiente, que el puntaje nunca salga de su banda,
 * y el comportamiento de las señales de HRV y FC de reposo (falsas alarmas con datos estables, detección de una caída real,
 * un solo día malo, datos insuficientes).
 */
import { hrvSignal, restingHrSignal, type DailyPoint } from "./training-engine/recovery-signals";
import { evaluateAvailability, signalChips, scoreAvailability, SCORE_BANDS, type AvailabilityStatus, type CheckinInput } from "./training-engine/availability-score";

let problems = 0, checks = 0;
const ok = (c: boolean, m: string) => { checks++; if (!c) { problems++; if (problems <= 25) console.log("FALLA:", m); } };

// RNG determinista
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());

const DAY = 86400000;
const today = new Date(Date.UTC(2026, 9, 11));
const sig = (hrvT: boolean, rhrT: boolean, method: "baseline" | "insufficient" = "baseline") => ({
  hrv: { method: hrvT || method === "baseline" ? "baseline" : "insufficient", triggered: hrvT, rolling7: 60, baseline: 62, delta: hrvT ? -9 : 0, reason: hrvT ? "hrv" : null } as const,
  rhr: { method: rhrT || method === "baseline" ? "baseline" : "insufficient", triggered: rhrT, rolling7: 50, baseline: 49, delta: rhrT ? 3 : 0, reason: rhrT ? "rhr" : null } as const,
});

// 1) Reglas del semáforo contra una implementación independiente
const subj = (n: number): CheckinInput => ({ fatigue: n >= 1 ? 6 : 3, stress: n >= 2 ? 6 : 3, muscleSoreness: n >= 3 ? 6 : 3, sleepQuality: n >= 4 ? 2 : 5 });
for (const h of [false, true]) for (const r of [false, true]) for (const s of [0, 1, 2, 3, 4]) for (const tsbAlert of [false, true]) {
  const { hrv, rhr } = sig(h, r);
  const ev = evaluateAvailability({ hrvSig: hrv as never, rhrSig: rhr as never, checkin: subj(s), tsb: tsbAlert ? -40 : -5, minTsb: -30 });
  const subjW = s === 0 ? 0 : s >= 3 ? 2 : 1; // el check-in cuenta 1 señal, o 2 si hay 3+ preguntas en alerta
  const n = (h ? 1 : 0) + (r ? 1 : 0) + subjW;
  const want: AvailabilityStatus = n >= 2 || (tsbAlert && n >= 1) ? "RED" : n === 1 || tsbAlert ? "AMBER" : "GREEN";
  ok(ev.status === want, `semáforo hrv=${h} rhr=${r} checkin=${s} tsbAlert=${tsbAlert}: ${ev.status} (esperado ${want})`);
  // Una sola señal aislada nunca da rojo
  if (n === 1 && !tsbAlert) ok(ev.status === "AMBER", `una sola señal debe dar ámbar (${h},${r},${s})`);
  // Todo rojo/ámbar tiene al menos un motivo escrito
  ok(ev.reasons.length > 0 && ev.reasons.every((x) => x.trim().length > 0), "motivos vacíos");
  // Chips = misma evaluación: cada alerta del semáforo se ve en su chip, y sin alertas no hay motivos de alerta
  const inp = { hrvSig: hrv as never, rhrSig: rhr as never, checkin: subj(s), tsb: tsbAlert ? -40 : -5, minTsb: -30 };
  const ch = signalChips(inp, ev);
  const st = (k: string) => ch.find((c) => c.key === k)!.state;
  ok(ch.length === 4, "deben ser 4 chips");
  ok((st("hrv") === "alert") === h && (st("resting_hr") === "alert") === r, `chips HRV/FC no coinciden (${h},${r})`);
  ok((st("checkin") === "alert") === (s > 0) && (st("tsb") === "alert") === tsbAlert, `chips check-in/TSB no coinciden (${s},${tsbAlert})`);
  ok((ch.filter((c) => c.state === "alert").length > 0) === (ev.alertReasons.length > 0), "motivos de alerta vs chips en alerta");
}

// 2) El puntaje siempre queda dentro de la banda de su semáforo
for (const status of ["GREEN", "AMBER", "RED"] as AvailabilityStatus[]) for (let i = 0; i < 4000; i++) {
  const sc = scoreAvailability({
    status,
    hrvDeltaPct: rnd() < 0.2 ? null : (rnd() - 0.5) * 60,
    restingHrDeltaAbs: rnd() < 0.2 ? null : (rnd() - 0.5) * 20,
    tsb: rnd() < 0.2 ? null : (rnd() - 0.5) * 90,
    checkin: rnd() < 0.3 ? null : { fatigue: 1 + Math.floor(rnd() * 7), stress: 1 + Math.floor(rnd() * 7), muscleSoreness: 1 + Math.floor(rnd() * 7), sleepQuality: 1 + Math.floor(rnd() * 7) },
  });
  const b = SCORE_BANDS[status];
  ok(Number.isInteger(sc.score) && sc.score >= b.lo && sc.score <= b.hi, `puntaje ${sc.score} fuera de banda ${status}`);
}

// 3) Señales con datos simulados
function series(days: number, mean: number, cv: number, mutate?: (i: number, v: number) => number): DailyPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const hrv = Math.max(5, mean * (1 + cv * gauss()));
    const rhr = Math.max(30, 50 + 2 * gauss());
    return { date: new Date(today.getTime() - (days - 1 - i) * DAY), hrv: mutate ? mutate(i, hrv) : hrv, restingHr: rhr };
  });
}
// 3a) Falsas alarmas con datos estables (60 días de base + evaluar cada día de los últimos 30)
for (const cv of [0.05, 0.08, 0.12]) {
  let hrvAlarms = 0, rhrAlarms = 0, both = 0, n = 0;
  for (let t = 0; t < 120; t++) {
    const pts = series(100, 60, cv);
    for (let d = 70; d < 100; d++) {
      const upTo = pts.slice(0, d + 1);
      const key = upTo[upTo.length - 1].date;
      const h = hrvSignal(upTo, key), r = restingHrSignal(upTo, key);
      n++;
      if (h.triggered) hrvAlarms++;
      if (r.triggered) rhrAlarms++;
      if (h.triggered && r.triggered) both++;
    }
  }
  const h = hrvAlarms / n, r = rhrAlarms / n, b = both / n;
  console.log(`datos estables CV ${Math.round(cv * 100)}%: alerta HRV ${(h * 100).toFixed(1)}% de los días, FC ${(r * 100).toFixed(1)}%, ambas (rojo) ${(b * 100).toFixed(1)}%`);
  ok(h < 0.2, `demasiadas falsas alarmas de HRV con CV ${cv}: ${(h * 100).toFixed(1)}%`);
  ok(b < 0.04, `demasiados rojos por azar con CV ${cv}: ${(b * 100).toFixed(1)}%`);
}
// 3b) Una caída real y sostenida de 12% se detecta en pocos días
{
  let detected = 0, within4 = 0, runs = 60;
  for (let t = 0; t < runs; t++) {
    const pts = series(100, 60, 0.07, (i, v) => (i >= 90 ? v * 0.88 : v));
    let first = -1;
    for (let d = 90; d < 100; d++) {
      const upTo = pts.slice(0, d + 1);
      if (hrvSignal(upTo, upTo[upTo.length - 1].date).triggered && first < 0) first = d - 90;
    }
    if (first >= 0) detected++;
    if (first >= 0 && first <= 4) within4++;
  }
  console.log(`caída sostenida de 12%: detectada en ${detected}/${runs}, dentro de 5 días en ${within4}/${runs}`);
  ok(detected / runs >= 0.8, `la caída real se detecta poco (${detected}/${runs})`);
}
// 3c) Un solo día malo: con −10% (variación normal de un día) casi nunca; con −25% (muy atípico) la media de 7 días baja ~3,6% y
// cae bajo el umbral (−0,5 DE) en una parte de los casos. Es una propiedad del método de Plews (media de 7 días), que se mide acá para saberlo.
for (const [drop, maxRate] of [[0.10, 0.35], [0.25, 0.8]] as const) {
  let alarms = 0, runs = 100;
  for (let t = 0; t < runs; t++) {
    const pts = series(100, 60, 0.07, (i, v) => (i === 99 ? v * (1 - drop) : v));
    if (hrvSignal(pts, pts[99].date).triggered) alarms++;
  }
  console.log(`un solo día malo (−${Math.round(drop * 100)}%): alerta de HRV en ${alarms}/${runs}`);
  ok(alarms / runs < maxRate, `un solo día de −${Math.round(drop * 100)}% dispara demasiado (${alarms}/${runs})`);
}
// 3d) Datos insuficientes: no se inventa nada
{
  const few = series(3, 60, 0.07);
  const h = hrvSignal(few, few[2].date);
  ok(h.method === "insufficient" && !h.triggered && h.delta == null, "con 3 datos debe ser insuficiente");
  const mid = series(15, 60, 0.07, (i, v) => (i >= 12 ? v * 0.8 : v));
  const h2 = hrvSignal(mid, mid[14].date);
  ok(h2.method === "fallback", `con 15 días debe usar el respaldo genérico (${h2.method})`);
  ok(h2.reason == null || /genérico/.test(h2.reason), "el respaldo debe decir que es genérico");
}
console.log({ checks, problems });
process.exit(problems ? 1 : 0);
