import { effortStats, thirds, compareWithPrior, weekLoadLine, type PriorSession } from "./session-insights";
import type { StoredLaps, Lap } from "./laps";

let problems = 0;
const eq = (name: string, a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) { problems++; console.error("FALLA", name, a, "!=", b); } };

const ftp = 230;
const mk = (n: number, avgW: number, durSec = 30): Lap => ({ n, startSec: n * 60, durSec, avgW, maxW: avgW + 50, avgHr: 150, maxHr: 170, cad: 95 });
// 9 esfuerzos que caen: 400,400,400,380,380,380,340,340,340
const laps = [400, 400, 400, 380, 380, 380, 340, 340, 340].map((w, i) => mk(i + 1, w));
const st: StoredLaps = { source: "fit", fetchedAt: "", laps };
const s = effortStats(st, ftp);
eq("n", s.short?.n, 9);
eq("primer tercio", Math.round(s.short!.firstThirdW), 400);
eq("último tercio", Math.round(s.short!.lastThirdW), 340);
eq("sin sprints", effortStats({ source: "fit", fetchedAt: "", laps: [mk(1, 150, 600)] }, ftp).short, null);

// tercios: 2 h, 1.er tercio 150 W, 2.º 140, 3.º 120
const p5 = [...Array(480).fill(150), ...Array(480).fill(140), ...Array(480).fill(120)];
eq("tercios", thirds(p5, [])?.w, [150, 140, 120]);
eq("tercios cortos", thirds(Array(100).fill(100), []), null);

const prior: PriorSession[] = [{ date: "2026-10-06", ifr: 0.8, tss: 110, decoupling: 8, ef: 1.2, stats: { short: { n: 9, meanW: 360, firstThirdW: 370, lastThirdW: 350 }, sustained: null } }];
const cmp = compareWithPrior({ ifr: 0.8, tss: 120, decoupling: 12, ef: 1.3, stats: s }, prior).join("\n");
if (!cmp.includes("(+3,7%)")) { problems++; console.error("comparación esperada +3,7%", cmp); }
eq("sin previos", compareWithPrior({ ifr: null, tss: null, decoupling: null, ef: null, stats: s }, []), []);
eq("carga", weekLoadLine(300, 200), "Carga de los últimos 7 días (con esta sesión): TSS 300 (+50% vs los 7 días anteriores: 200).");
console.log({ problems });
console.log(cmp);
