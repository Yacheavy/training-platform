/**
 * Variantes de VO2max (HIIT genuino, Rønnestad, 5′, 2′40″, supramáximo, 15/15, Billat 30/30, pirámide):
 * estructura de cada una, que el plan las rote sin advertencias y que ninguna se quede sin aparecer.
 * Corre con: npx tsx lib/vo2-variants-check.ts   (puro, no toca ninguna base)
 */
import { buildPlan } from "./training-engine/plan-builder";
import { validatePlan } from "./training-engine/plan-validator";
import { buildBlocks } from "./training-engine/block-builder";
import { VARIANTS } from "./training-engine/variants";

const NEW_KEYS = ["vo2_pmax", "vo2_supra_30", "vo2_corto_15_15", "billat_30_30", "vo2_piramide"];
const ALL_VO2 = Object.values(VARIANTS).filter((v) => v.vo2).map((v) => v.key);
let bad = 0, checks = 0;
const fail = (m: string) => { bad++; if (bad <= 25) console.log("FALLA:", m); };
const ok = (c: boolean, m: string) => { checks++; if (!c) fail(m); };

ok(ALL_VO2.length === 8, `esperaba 8 variantes de VO2max y hay ${ALL_VO2.length}: ${ALL_VO2.join(", ")}`);
for (const k of NEW_KEYS) ok(!!VARIANTS[k], `falta ${k} en el catálogo`);

// 1) Constructor directo: estructura por variante, FTP, PAM, duración y progresión
for (const k of NEW_KEYS) for (const ftp of [150, 220, 300, 400]) for (const pam of [null, Math.round(ftp * 1.15), Math.round(ftp * 1.3)])
for (const dur of [45, 60, 75, 90, 120, 180]) for (const step of [0, 1, 2, 3]) for (const series of [undefined, 1, 2, 3]) for (const maint of [false, true]) {
  const b = buildBlocks(k, dur, ftp, null, null, step, series, pam, maint);
  const tag = `${k} ftp${ftp} pam${pam} ${dur}′ paso${step} serie${series} ${maint ? "mant" : ""}`;
  ok(b.every((x) => Number.isFinite(x.targetWatts) && x.targetWatts > 0 && x.durationSec > 0), `${tag}: bloque inválido`);
  const iv = b.filter((x) => x.type === "interval");
  ok(iv.length > 0, `${tag}: sin intervalos`);
  ok(iv.every((x) => x.targetWatts >= ftp), `${tag}: intervalo por debajo del FTP`);
  ok(b.some((x) => x.type.startsWith("cooldown")) && b.some((x) => x.type.startsWith("warmup")), `${tag}: sin calentamiento o vuelta a la calma`);
  const lastIv = b.map((x) => x.type).lastIndexOf("interval");
  const firstCool = b.findIndex((x) => x.type.startsWith("cooldown"));
  ok(lastIv < firstCool, `${tag}: intervalos después de la vuelta a la calma`);
  const total = b.reduce((s, x) => s + x.durationSec, 0);
  ok(total <= 4 * 3600, `${tag}: dura ${Math.round(total / 60)} min`);
  if (k === "vo2_pmax" || k === "vo2_supra_30") ok(total <= dur * 60 + 60 || iv.length <= (k === "vo2_pmax" ? 3 : 4), `${tag}: ${Math.round(total / 60)} min excede el tiempo del día con más repeticiones que el mínimo`);
  if (k === "vo2_pmax") ok(iv.every((x) => x.durationSec === 160) && iv.length >= 3 && iv.length <= 8, `${tag}: estructura 2′40″`);
  if (k === "vo2_supra_30") ok(iv.every((x) => x.durationSec === 30) && iv.length >= 4 && iv.length <= 12 && iv.every((x) => x.targetWatts <= ftp * 2.6 + 1), `${tag}: estructura supramáxima`);
  if (k === "vo2_corto_15_15") ok(iv.every((x) => x.durationSec === 15) && iv.length % 20 === 0 && iv.length <= 60, `${tag}: estructura 15/15`);
  if (k === "billat_30_30") ok(iv.every((x) => x.durationSec === 30) && iv.length >= 10 && iv.length <= 30, `${tag}: estructura 30/30 (${iv.length})`);
  if (k === "vo2_piramide") {
    const m = iv.map((x) => x.durationSec / 60);
    const peak = m.indexOf(Math.max(...m));
    ok(m.slice(0, peak + 1).every((x, i, a) => i === 0 || x >= a[i - 1]) && m.slice(peak).every((x, i, a) => i === 0 || x <= a[i - 1]) && m.length >= 5, `${tag}: pirámide ${m.join("-")}`);
  }
}
// La progresión crece: más repeticiones o más trabajo con el paso
for (const k of ["vo2_pmax", "vo2_supra_30", "vo2_piramide"]) {
  const work = (step: number) => buildBlocks(k, 150, 300, null, null, step, undefined, 360, false).filter((x) => x.type === "interval").reduce((s, x) => s + x.durationSec, 0);
  ok(work(0) <= work(1) && work(1) <= work(2) && work(0) < work(2), `${k}: la progresión no crece (${work(0)}, ${work(1)}, ${work(2)})`);
}
{
  const reps = (series: number) => buildBlocks("billat_30_30", 120, 300, null, null, 0, series, 360, false).filter((x) => x.type === "interval").length;
  ok(reps(1) < reps(2) && reps(2) < reps(3), `billat: la dosis no crece (${reps(1)}, ${reps(2)}, ${reps(3)})`);
  const s = (n: number) => buildBlocks("vo2_corto_15_15", 120, 300, null, null, 0, n, 360, false).filter((x) => x.type === "interval").length;
  ok(s(1) === 20 && s(2) === 40 && s(3) === 60, `15/15: series 1→3 dan ${s(1)}, ${s(2)}, ${s(3)}`);
}

// 2) Planes: rotación sin advertencias y todas las variantes aparecen
const L = (lo: number | null, hi: number | null, mx: number | null = null) => ({ intensityPctFtpLow: lo, intensityPctFtpHigh: hi, maxSessionsPerWeek: mx });
// librería SIN las variantes nuevas (como en la base real): el constructor no debe depender de ella
const library: any = { z2: L(56, 75), sweet_spot: L(88, 94), umbral: L(95, 105, 2), hiit_genuino: L(108, 115, 1), ronnestad_30_15: L(125, 135), z2_sprints: L(null, null), gym: L(null, null), z2_progressive: L(56, 75), endurance_tempo: L(78, 86, 2), over_under: L(92, 106, 1), vo2_long: L(108, 115, 1), sprint_neuro: L(null, null, 1), long_durability: L(84, 90, 1), torque_low_cadence: L(70, 76, 1) };
const T = (d: number, s: string, q: boolean, m: number | null) => ({ dayOfWeek: d, stimulusType: s, isQualityDay: q, targetDurationMin: m });
const templates: Record<string, any[]> = {
  largo: [T(1, "cycling", true, 120), T(2, "cycling", false, 90), T(3, "cycling", true, 100), T(5, "cycling", false, 120), T(6, "cycling", false, 240), T(0, "cycling", false, 150)],
  corto: [T(2, "cycling", true, 60), T(4, "cycling", true, 60), T(6, "cycling", false, 120)],
  gym: [T(1, "cycling", true, 75), T(2, "cycling", false, 120), T(3, "gym", false, 90), T(4, "cycling", true, 90), T(5, "gym", false, 90), T(6, "cycling", false, 180), T(0, "cycling", false, 240)],
  tres: [T(0, "cycling", false, 150), T(2, "cycling", true, 75), T(4, "cycling", true, 60)],
};
const seen = new Map<string, number>();
let scenarios = 0;
const DAY = 86400000;
for (const [tn, tpl] of Object.entries(templates))
for (const variety of ["balanced", "varied"] as const)
for (const vo2Stimulus of [null, "rotate"])
for (const pvo2 of [null, 380])
for (const ratio of ["3:1", "4:1"])
for (const periodization of ["linear", "block"])
for (const weeks of [6, 10, 16]) {
  const start = new Date(Date.UTC(2026, 9, 5, 20, 12, 10));
  const end = new Date(start.getTime() + weeks * 7 * DAY);
  const thr = { deloadRatio: ratio, weeksBetweenFtpTest: 6, ftpTestProtocol: "20min", varietyLevel: variety, vo2Stimulus, periodization, flexibilityEnabled: false, contrastMode: "off" };
  const plan = buildPlan({ block: { name: "VO2", objective: "vo2max", startDate: start, endDate: end }, ftp: 300, pvo2maxWatts: pvo2, thresholds: thr as any, template: tpl, library });
  scenarios++;
  const w = validatePlan(plan, { objective: "vo2max", ftp: 300, pvo2maxWatts: pvo2 }).filter((x) => !x.startsWith("INFO"));
  ok(w.length === 0, `${tn} ${variety} ${vo2Stimulus} pam${pvo2} ${ratio} ${periodization} ${weeks}s: ${[...new Set(w)].slice(0, 3).join(" | ")}`);
  for (const d of plan) if (VARIANTS[d.stimulusType]?.vo2) seen.set(d.stimulusType, (seen.get(d.stimulusType) ?? 0) + 1);
}
console.log({ scenarios, aparicionesPorVariante: Object.fromEntries(ALL_VO2.map((k) => [k, seen.get(k) ?? 0])) });
for (const k of ALL_VO2) ok((seen.get(k) ?? 0) > 0, `la variante ${k} nunca aparece en los planes`);

// Conservador sin preferencia: se mantiene el HIIT genuino de siempre
{
  const start = new Date(Date.UTC(2026, 9, 5, 20, 12, 10));
  const plan = buildPlan({ block: { name: "VO2", objective: "vo2max", startDate: start, endDate: new Date(start.getTime() + 10 * 7 * DAY) }, ftp: 300, pvo2maxWatts: 380, thresholds: { deloadRatio: "3:1", weeksBetweenFtpTest: 6, varietyLevel: "conservative", vo2Stimulus: null, flexibilityEnabled: false } as any, template: templates.largo, library });
  const keys = new Set(plan.filter((d) => VARIANTS[d.stimulusType]?.vo2).map((d) => d.stimulusType));
  ok(keys.size === 1 && keys.has("hiit_genuino"), `conservador debía quedarse en HIIT genuino y usó ${[...keys].join(", ")}`);
}
// Preferencia explícita: respeta la elección del atleta
for (const pref of ["hiit_genuino", "ronnestad_30_15"]) {
  const start = new Date(Date.UTC(2026, 9, 5, 20, 12, 10));
  const plan = buildPlan({ block: { name: "VO2", objective: "vo2max", startDate: start, endDate: new Date(start.getTime() + 8 * 7 * DAY) }, ftp: 300, pvo2maxWatts: 380, thresholds: { deloadRatio: "3:1", weeksBetweenFtpTest: 6, varietyLevel: "varied", vo2Stimulus: pref, flexibilityEnabled: false } as any, template: templates.largo, library });
  const keys = new Set(plan.filter((d) => VARIANTS[d.stimulusType]?.vo2).map((d) => d.stimulusType));
  ok(keys.size === 1 && keys.has(pref), `preferencia ${pref} no se respetó: ${[...keys].join(", ")}`);
}
console.log({ checks, problems: bad });
process.exit(bad ? 1 : 0);
