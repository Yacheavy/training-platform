// Prueba de lectura de vueltas: arma un FIT sintético (calentamiento, 4 intervalos con recuperación, enfriamiento) y verifica lo que se lee.
// Ejecutar: npx tsx lib/laps-check.ts
import { gzipSync } from "node:zlib";
import { FitEncoder, FitBaseType } from "fit-file-parser/encoder";
import { parseFitLaps, describeLaps, type StoredLaps } from "./laps";

const start = new Date("2026-10-08T12:00:00Z");
const enc = new FitEncoder();
const plan = [
  { dur: 600, w: 140, hr: 118 }, // calentamiento
  ...Array.from({ length: 4 }, (_, i) => [{ dur: 240, w: 330 + i, hr: 165 + i }, { dur: 180, w: 120, hr: 140 }]).flat(),
  { dur: 480, w: 130, hr: 125 }, // enfriamiento
];
let t = 0;
for (const p of plan) {
  const st = FitEncoder.toFitTimestamp(new Date(start.getTime() + t * 1000));
  enc.writeMessage(19, [
    { number: 253, size: 4, baseType: FitBaseType.Uint32, value: st + p.dur },
    { number: 2, size: 4, baseType: FitBaseType.Uint32, value: st },
    { number: 7, size: 4, baseType: FitBaseType.Uint32, value: p.dur * 1000 },
    { number: 8, size: 4, baseType: FitBaseType.Uint32, value: p.dur * 1000 },
    { number: 15, size: 1, baseType: FitBaseType.Uint8, value: p.hr },
    { number: 16, size: 1, baseType: FitBaseType.Uint8, value: p.hr + 8 },
    { number: 19, size: 2, baseType: FitBaseType.Uint16, value: p.w },
    { number: 20, size: 2, baseType: FitBaseType.Uint16, value: p.w + 90 },
  ]);
  t += p.dur;
}
const bytes = enc.close();

(async () => {
  let problems = 0;
  const check = (ok: boolean, msg: string) => { if (!ok) { problems++; console.log("FALLA:", msg); } };
  for (const [name, input] of [["fit", bytes], ["fit.gz", gzipSync(Buffer.from(bytes))]] as const) {
    const laps = await parseFitLaps(input);
    check(laps.length === plan.length, `${name}: ${laps.length} vueltas, esperadas ${plan.length}`);
    check(laps[0]?.durSec === 600 && laps[0]?.avgW === 140 && laps[0]?.avgHr === 118, `${name}: calentamiento mal leído ${JSON.stringify(laps[0])}`);
    check(laps[1]?.durSec === 240 && laps[1]?.avgW === 330 && laps[1]?.maxW === 420, `${name}: intervalo 1 mal leído ${JSON.stringify(laps[1])}`);
    check(laps[1]?.startSec === 600 && laps[3]?.startSec === 600 + 240 + 180, `${name}: inicios mal calculados`);
    const stored: StoredLaps = { source: "fit", fetchedAt: "x", laps };
    const txt = describeLaps(stored, 300);
    check(/≥ 90% del FTP \(270 W[^)]*\): 4 \(V2, V4, V6, V8\)/.test(txt), `${name}: conteo de trabajo duro incorrecto\n${txt}`);
    if (name === "fit") console.log(txt.split("\n").slice(0, 5).join("\n"));
  }
  console.log({ problems });
  process.exit(problems ? 1 : 0);
})();
