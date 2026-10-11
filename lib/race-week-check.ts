/**
 * Semana de carrera: mini-taper, activación de la víspera, calentamiento del día, sin gimnasio ni calidad en los últimos días.
 * Corre con: npx tsx lib/race-week-check.ts   (puro, no toca ninguna base)
 */
import { buildPlan, type PlannedDay } from "./training-engine/plan-builder";
import { validatePlan } from "./training-engine/plan-validator";
import { dateKeyLocal, dayOfWeekLocal } from "./tz";
import {
  ACTIVATION_KEY, RACE_WARMUP_KEY, RACE_EASY_MAX_MIN, NO_QUALITY_DAYS, MINI_TAPER_DAYS, gymFreeDays, raceContext, daysBetween,
  buildActivationBlocks, buildRaceWarmupBlocks, activationSpec, COURSE_PROFILES, type RaceEvent, type CourseProfile,
} from "./training-engine/race-week";
import { isOffBike } from "./training-engine/off-bike";

const L = (lo: number | null, hi: number | null, mx: number | null = null) => ({ intensityPctFtpLow: lo, intensityPctFtpHigh: hi, maxSessionsPerWeek: mx });
const library: any = { z2: L(56, 75), sweet_spot: L(88, 94), umbral: L(95, 105, 2), hiit_genuino: L(108, 115, 1), ronnestad_30_15: L(125, 135), z2_sprints: L(null, null), billat_30_30: L(110, 116), rst: L(150, 180), gym: L(null, null), z2_progressive: L(56, 75), endurance_tempo: L(78, 86, 2), over_under: L(92, 106, 1), vo2_long: L(108, 115, 1), sprint_neuro: L(null, null, 1), long_durability: L(84, 90, 1), torque_low_cadence: L(70, 76, 1) };
const T = (d: number, s: string, q: boolean, m: number | null) => ({ dayOfWeek: d, stimulusType: s, isQualityDay: q, targetDurationMin: m });
const templates: Record<string, any[]> = {
  user: [T(1, "cycling", true, 60), T(2, "cycling", false, 120), T(3, "gym", false, 90), T(4, "cycling", true, 120), T(5, "gym", false, 90), T(6, "cycling", false, 180), T(0, "cycling", false, 240)],
  twoQ: [T(2, "cycling", true, 75), T(4, "cycling", true, 75), T(6, "cycling", false, 150), T(0, "cycling", false, 120), T(1, "rest", false, 0)],
  threeQ: [T(1, "cycling", true, 60), T(3, "cycling", true, 60), T(5, "cycling", true, 60), T(0, "cycling", false, 150)],
  consecutive: [T(1, "cycling", true, 60), T(2, "cycling", true, 60), T(4, "cycling", false, 90), T(6, "cycling", false, 120)],
  oneQ: [T(3, "cycling", true, 60), T(6, "cycling", false, 180)],
  withRest: [T(1, "cycling", true, 60), T(2, "rest", false, 0), T(3, "gym", false, 60), T(4, "flexibility", false, 20), T(5, "rest", false, 0), T(6, "cycling", false, 150), T(0, "cycling", false, 90)],
};

let bad = 0;
let checks = 0;
const fail = (msg: string) => { bad++; if (bad <= 25) console.log("FALLA:", msg); };
const ok = (cond: boolean, msg: string) => { checks++; if (!cond) fail(msg); };

const baseThr = { deloadRatio: "3:1", weeksBetweenFtpTest: 5, ftpTestProtocol: "20min", varietyLevel: "balanced" as const, flexibilityEnabled: true };
const DAY = 86400000;
const keyOf = (d: PlannedDay) => dateKeyLocal(d.date);

function run(objective: string, tpl: any[], weeks: number, startDow: number, events: RaceEvent[], thr: any = baseThr) {
  const start = new Date(Date.UTC(2026, 9, 3 + ((startDow - 6 + 7) % 7), 20, 12, 10));
  const end = new Date(start.getTime() + weeks * 7 * DAY);
  const plan = buildPlan({ block: { name: "t", objective, startDate: start, endDate: end }, ftp: 300, thresholds: thr, template: tpl, library, events });
  return { plan, start, end };
}

let scenarios = 0;
for (const objective of ["base", "umbral", "vo2max", "tapering"])
for (const [tn, tpl] of Object.entries(templates))
for (const weeks of [2, 3, 5, 8])
for (const startDow of [0, 3, 6])
for (const priority of ["A", "B"])
for (const profile of [null, ...COURSE_PROFILES.map((p) => p.key)] as (CourseProfile | null)[])
for (const evBack of [0, 1, 3, 6, 9]) {
  // Para no multiplicar de más, los perfiles se barren solo con 3 semanas y 2 tipos de semana
  if (profile && (weeks !== 3 || !(tn === "user" || tn === "twoQ"))) continue;
  // El evento cae dentro del bloque (evBack días antes del último día) o, en un taper, justo al terminar
  const start = new Date(Date.UTC(2026, 9, 3 + ((startDow - 6 + 7) % 7), 20, 12, 10));
  const totalDays = weeks * 7;
  const evOffset = objective === "tapering" ? totalDays : totalDays - 1 - evBack;
  if (objective === "tapering" && evBack > 0) continue;
  if (evOffset < 0) continue;
  const evKey = dateKeyLocal(new Date(start.getTime() + evOffset * DAY));
  const events: RaceEvent[] = [{ dateKey: evKey, priority, name: "Carrera", profile }];
  const { plan } = run(objective, tpl, weeks, startDow, events);
  scenarios++;
  const tag = `${objective} ${tn} ${weeks}s dow${startDow} ${priority} atrás${evBack} ${profile ?? "sin perfil"}`;

  const w = validatePlan(plan, { objective, ftp: 300, events }).filter((x) => !x.startsWith("INFO"));
  ok(w.length === 0, `${tag}: ${[...new Set(w)].slice(0, 3).join(" | ")}`);

  const byKey = new Map(plan.map((d) => [keyOf(d), d]));
  const eve = byKey.get(dateKeyLocal(new Date(start.getTime() + (evOffset - 1) * DAY)));
  const raceDay = byKey.get(evKey);
  if (evOffset - 1 >= 0) ok(!!eve && eve.stimulusType === ACTIVATION_KEY, `${tag}: la víspera no es activación (${eve?.stimulusType})`);
  ok(!!raceDay && raceDay.stimulusType === RACE_WARMUP_KEY, `${tag}: el día de la carrera no tiene calentamiento (${raceDay?.stimulusType})`);
  if (eve) {
    const n = eve.blocks.filter((b) => b.type === "interval").length;
    const sp = activationSpec(profile);
    ok(n === sp.reps[priority as "A" | "B"], `${tag}: ${n} aperturas`);
    ok(eve.blocks.filter((b) => b.type === "interval").every((b) => b.durationSec === sp.sec && Math.abs(b.targetWatts - 300 * sp.pct) <= 1), `${tag}: apertura distinta de la receta del perfil`);
  }
  // Ningún día de la ventana tiene gimnasio, calidad ni rodajes largos
  for (const d of plan) {
    const r = raceContext(keyOf(d), events);
    if (!r) continue;
    if (r.daysTo >= 1 && r.daysTo <= gymFreeDays(r.priority)) ok(d.stimulusType !== "gym", `${tag}: gimnasio a ${r.daysTo} días`);
    if (r.daysTo >= 2 && r.daysTo <= NO_QUALITY_DAYS) {
      const mins = d.blocks.reduce((s, b) => s + b.durationSec, 0) / 60;
      ok(isOffBike(d.stimulusType) || (d.stimulusType === "z2" && !d.blocks.some((b) => b.type === "interval") && mins <= RACE_EASY_MAX_MIN + 1), `${tag}: ${d.stimulusType} ${Math.round(mins)}′ a ${r.daysTo} días`);
    }
    if (r.daysTo >= 2 && r.daysTo <= MINI_TAPER_DAYS && !isOffBike(d.stimulusType)) {
      const slotMin = tpl.find((t) => t.dayOfWeek === d.dayOfWeek)?.targetDurationMin ?? 60;
      const mins = d.blocks.reduce((s, b) => s + b.durationSec, 0) / 60;
      // el protocolo puede necesitar más que el slot reducido, pero nunca más que el slot completo de la semana tipo + margen
      ok(mins <= Math.max(slotMin, 40) * 1.25 + 5, `${tag}: sesión de ${Math.round(mins)}′ en el mini-taper con slot de ${slotMin}′`);
    }
    ok(!d.stimulusType.startsWith("ftp_test"), `${tag}: test de FTP en la semana de carrera`);
  }
  // Puesta a punto: la sesión de calidad de mantenimiento sigue presente si la semana tipo tiene una a 4 días o más
  if (objective === "tapering" && weeks >= 2) {
    const lastWeek = plan.filter((d) => d.dayOffset >= totalDays - 7 && d.dayOffset < totalDays);
    const hasEligibleSlot = [0, 1, 2, 3, 4, 5, 6].some((o) => {
      const dt = new Date(start.getTime() + (totalDays - 7 + o) * DAY);
      const s = tpl.find((t) => t.dayOfWeek === dayOfWeekLocal(dt));
      return !!s && s.stimulusType === "cycling" && s.isQualityDay && daysBetween(dateKeyLocal(dt), evKey) >= MINI_TAPER_DAYS;
    });
    if (hasEligibleSlot) ok(lastWeek.some((d) => d.stimulusType === "hiit_genuino" || d.stimulusType === "z2_sprints"), `${tag}: la última semana perdió la sesión de intensidad de mantenimiento`);
  }
}
console.log({ scenarios });

// Sin eventos, una prioridad C o un evento fuera del bloque: el plan es idéntico al de siempre
for (const objective of ["base", "umbral", "vo2max"])
for (const [tn, tpl] of Object.entries(templates))
for (const startDow of [0, 3, 6]) {
  const weeks = 6;
  const start = new Date(Date.UTC(2026, 9, 3 + ((startDow - 6 + 7) % 7), 20, 12, 10));
  const keyAt = (o: number) => dateKeyLocal(new Date(start.getTime() + o * DAY));
  const sig = (p: PlannedDay[]) => JSON.stringify(p.map((d) => [d.dayOffset, d.stimulusType, d.blocks.length, d.tss]));
  const none = sig(run(objective, tpl, weeks, startDow, []).plan);
  ok(sig(run(objective, tpl, weeks, startDow, [{ dateKey: keyAt(30), priority: "C" }]).plan) === none, `C cambia el plan: ${objective} ${tn}`);
  ok(sig(run(objective, tpl, weeks, startDow, [{ dateKey: keyAt(400), priority: "A" }]).plan) === none, `evento lejano cambia el plan: ${objective} ${tn}`);
  ok(sig(run(objective, tpl, weeks, startDow, [{ dateKey: keyAt(-20), priority: "A" }]).plan) === none, `evento pasado cambia el plan: ${objective} ${tn}`);
  ok(!run(objective, tpl, weeks, startDow, []).plan.some((d) => d.stimulusType === ACTIVATION_KEY || d.stimulusType === RACE_WARMUP_KEY), `sesiones de carrera sin evento: ${objective} ${tn}`);
}

// Una B a 10 días de una A, una A y una B el mismo día, dos B seguidas: sin errores y con reglas válidas
for (const tn of Object.keys(templates)) {
  const start = new Date(Date.UTC(2026, 9, 5, 20, 12, 10));
  const keyAt = (o: number) => dateKeyLocal(new Date(start.getTime() + o * DAY));
  const cases: RaceEvent[][] = [
    [{ dateKey: keyAt(20), priority: "A" }, { dateKey: keyAt(30), priority: "B" }],
    [{ dateKey: keyAt(20), priority: "A" }, { dateKey: keyAt(20), priority: "B" }],
    [{ dateKey: keyAt(20), priority: "B" }, { dateKey: keyAt(22), priority: "B" }],
    [{ dateKey: keyAt(20), priority: "B" }, { dateKey: keyAt(21), priority: "A" }],
  ];
  for (const events of cases) {
    const { plan } = run("umbral", templates[tn], 6, 1, events);
    const w = validatePlan(plan, { objective: "umbral", ftp: 300, events }).filter((x) => !x.startsWith("INFO"));
    ok(w.length === 0, `eventos cercanos ${tn} ${JSON.stringify(events.map((e) => [e.dateKey.slice(5), e.priority]))}: ${[...new Set(w)].slice(0, 2).join(" | ")}`);
  }
}

// Las sesiones especiales: estructura y tiempos, para cada perfil (y sin perfil)
const WARMUP_MIN: Record<string, [number, number, number, number]> = {
  generic: [18, 21, 2, 2], llano: [18, 21, 2, 2], fondo: [14, 18, 1, 1], montana: [18, 22, 2, 2], ondulado: [18, 22, 3, 3], contrarreloj: [21, 25, 2, 2], criterium: [19, 23, 4, 4],
};
for (const ftp of [150, 220, 300, 400]) for (const pr of ["A", "B"] as const) for (const profile of [null, ...COURSE_PROFILES.map((p) => p.key)] as (CourseProfile | null)[]) {
  const sp = activationSpec(profile);
  const a = buildActivationBlocks(ftp, pr, 40, profile);
  const total = a.reduce((s, b) => s + b.durationSec, 0);
  ok(total >= 38 * 60 && total <= 42 * 60, `activación ${profile} dura ${total / 60}′`);
  const iv = a.filter((b) => b.type === "interval");
  ok(iv.length === sp.reps[pr], `n aperturas ${profile}`);
  ok(iv.every((b) => b.durationSec === sp.sec && Math.abs(b.targetWatts - ftp * sp.pct) <= 1), `watts/duración de aperturas ${profile}`);
  ok(iv.reduce((s, b) => s + b.durationSec, 0) <= total * 0.07, `aperturas ${profile} pasan del 7 %`);
  const wu = buildRaceWarmupBlocks(ftp, profile);
  const wt = wu.reduce((s, b) => s + b.durationSec, 0);
  const [lo, hi, nlo, nhi] = WARMUP_MIN[profile ?? "generic"];
  const na = wu.filter((b) => b.type === "warmup_activation").length;
  ok(wt >= lo * 60 && wt <= hi * 60 && wu.every((b) => b.type.startsWith("warmup")), `calentamiento ${profile} dura ${wt / 60}′`);
  ok(na >= nlo && na <= nhi, `calentamiento ${profile}: ${na} activaciones`);
  ok(wu[wu.length - 1].type === "warmup_recovery", `calentamiento ${profile} no termina en recuperación`);
}

// Entrada de perfil: valores raros se normalizan a "sin perfil"
import { normalizeCourseProfile } from "./training-engine/race-week";
for (const v of [null, undefined, "", "xxx", 5, "LLANO", " montana"]) ok(normalizeCourseProfile(v) === null || COURSE_PROFILES.some((p) => p.key === normalizeCourseProfile(v)), `normalizeCourseProfile(${String(v)})`);
ok(normalizeCourseProfile("montana") === "montana", "normalize montana");
ok(normalizeCourseProfile("xxx") === null, "normalize xxx");

// Sugerencia "generar hoy" sin plan: misma lógica que el planificador
import { raceAdjust } from "./training-engine/race-week";
for (const pr of ["A", "B"] as const) for (let d = 0; d <= 7; d++) for (const slot of [null, "rest", "cycling", "gym", "flexibility"]) {
  const r = raceContext("2026-11-01", [{ dateKey: keyPlus("2026-11-01", d), priority: pr }]);
  const a = raceAdjust(r, slot);
  const tag = `raceAdjust ${pr} d${d} ${slot}`;
  if (d === 0) ok(a?.kind === "warmup", tag);
  else if (d === 1) ok(a?.kind === "activation" && a.optional === (slot === null || slot === "rest"), tag);
  else if (slot === "gym" && d <= gymFreeDays(pr)) ok(a?.kind === "no_gym", tag);
  else if (slot === "cycling" && d <= NO_QUALITY_DAYS) ok(a?.kind === "easy", tag);
  else if (slot === "cycling" && d <= MINI_TAPER_DAYS) ok(a?.kind === "taper", tag);
  else ok(a === null, tag);
}
function keyPlus(k: string, n: number) { return new Date(Date.parse(k + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10); }
ok(raceAdjust(null, "cycling") === null, "raceAdjust sin carrera");

console.log({ checks, problems: bad });
process.exit(bad ? 1 : 0);
