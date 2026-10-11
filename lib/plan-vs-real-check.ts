// Comparación plan vs esfuerzos detectados. Ejecutar: npx tsx lib/plan-vs-real-check.ts
import { comparePlanVsReal, plannedHardStretches } from "./plan-vs-real";

let problems = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { problems++; console.log("FALLA:", msg); } };
const FTP = 300;
const z2 = [{ type: "warmup", durationSec: 600, targetWatts: 150 }, { type: "z2", durationSec: 7200, targetWatts: 190 }, { type: "cooldown", durationSec: 600, targetWatts: 140 }];
const iv = (n: number, sec: number, w: number) => Array.from({ length: n }, (_, i) => [{ type: "interval", durationSec: sec, targetWatts: w }, ...(i < n - 1 ? [{ type: "recovery", durationSec: 180, targetWatts: 120 }] : [])]).flat();
const e = (startSec: number, durSec: number, avgW: number) => ({ startSec, durSec, avgW });

// Plan de Z2 + esfuerzos reales: fuera de lo planeado (caso real del 11/10)
let t = comparePlanVsReal(z2, [e(1500, 225, 341), e(3000, 142, 364), e(5000, 130, 289)], FTP);
check(/NO tenía trabajo/.test(t) && /FUERA de lo planeado/.test(t) && /8 min en total/.test(t) && /364 W \(121% del FTP\)/.test(t), `z2 con esfuerzos: ${t}`);
// Plan de Z2 sin esfuerzos
t = comparePlanVsReal(z2, [], FTP);
check(/sin desvío de intensidad/.test(t), `z2 sin esfuerzos: ${t}`);
// Esfuerzos mínimos (menos de 3 min) no se marcan como desvío
t = comparePlanVsReal(z2, [e(100, 100, 300)], FTP);
check(/sin desvío/.test(t), `esfuerzo corto: ${t}`);
// Plan 4×8′ y real similar
const p4 = [...z2.slice(0, 1), ...iv(4, 480, 300), ...z2.slice(2)];
check(plannedHardStretches(p4, FTP).length === 4, "4 tramos planeados");
t = comparePlanVsReal(p4, [e(0, 470, 298), e(0, 470, 301), e(0, 460, 299), e(0, 450, 297)], FTP);
check(/similar al planeado/.test(t) && !/supera/.test(t), `similar: ${t}`);
// Real con mucho más trabajo y más fuerte
t = comparePlanVsReal(p4, [e(0, 900, 330), e(0, 900, 335), e(0, 900, 332), e(0, 900, 331)], FTP);
check(/MÁS trabajo/.test(t) && /supera en más de 8%/.test(t), `más: ${t}`);
// Real con menos
t = comparePlanVsReal(p4, [e(0, 480, 300)], FTP);
check(/MENOS trabajo/.test(t), `menos: ${t}`);
// Plan con intervalos pero sin tramos detectados
t = comparePlanVsReal(p4, [], FTP);
check(/no se detectó ningún tramo/.test(t), `ninguno: ${t}`);
// Intervalos cortos (30/15): no compara cantidades
const short = [{ type: "warmup", durationSec: 600, targetWatts: 150 }, ...Array.from({ length: 13 }, () => [{ type: "interval", durationSec: 30, targetWatts: 390 }, { type: "recovery", durationSec: 15, targetWatts: 150 }]).flat()];
t = comparePlanVsReal(short, [e(600, 600, 330)], FTP);
check(/intervalos cortos/.test(t) && /No compares cantidades/.test(t), `cortos: ${t}`);
// La activación del calentamiento a vatios altos no cuenta como trabajo
const act = [{ type: "warmup_activation", durationSec: 60, targetWatts: 400 }, ...z2];
check(plannedHardStretches(act, FTP).length === 0, "la activación no es trabajo");
// Bloques contiguos se unen; la recuperación corta
check(plannedHardStretches([{ type: "interval", durationSec: 300, targetWatts: 300 }, { type: "interval", durationSec: 300, targetWatts: 310 }, { type: "recovery", durationSec: 120, targetWatts: 100 }, { type: "interval", durationSec: 300, targetWatts: 300 }], FTP).map((x) => x.durSec).join() === "600,300", "unión de bloques");
console.log(t);
console.log({ problems });
process.exit(problems ? 1 : 0);
