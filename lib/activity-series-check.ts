// Prueba de lectura de series: arma un FIT sintético (potencia, FC, cadencia, velocidad, altitud) y verifica lo que se lee.
// Ejecutar: npx tsx lib/activity-series-check.ts
import { gzipSync } from "node:zlib";
import { FitEncoder, FitBaseType } from "fit-file-parser/encoder";
import { parseFitSeries, bucketSamples, stepFor } from "./activity-series";

const start = new Date("2026-10-08T12:00:00Z");
const enc = new FitEncoder();
const DUR = 1800;
for (let s = 0; s < DUR; s++) {
  const st = FitEncoder.toFitTimestamp(new Date(start.getTime() + s * 1000));
  const hard = s >= 600 && s < 900;
  enc.writeMessage(20, [
    { number: 253, size: 4, baseType: FitBaseType.Uint32, value: st },
    { number: 7, size: 2, baseType: FitBaseType.Uint16, value: hard ? 300 : 150 },
    { number: 3, size: 1, baseType: FitBaseType.Uint8, value: hard ? 170 : 125 },
    { number: 4, size: 1, baseType: FitBaseType.Uint8, value: hard ? 95 : 85 },
    { number: 6, size: 2, baseType: FitBaseType.Uint16, value: 8333 },
    { number: 2, size: 2, baseType: FitBaseType.Uint16, value: (100 + 500) * 5 },
  ]);
}
const bytes = enc.close();

(async () => {
  let problems = 0;
  const check = (ok: boolean, msg: string) => { if (!ok) { problems++; console.log("FALLA:", msg); } };
  for (const [name, input] of [["fit", bytes], ["fit.gz", gzipSync(Buffer.from(bytes))]] as const) {
    const s = await parseFitSeries(input, DUR);
    check(!!s, `${name}: no se leyó nada`);
    if (!s) continue;
    check(s.stepSec === 5, `${name}: paso ${s.stepSec}`);
    check(Math.abs(s.power.length - DUR / 5) <= 1, `${name}: ${s.power.length} puntos, esperados ~${DUR / 5}`);
    check(s.power[10] === 150 && s.power[150] === 300, `${name}: potencia ${s.power[10]}/${s.power[150]}`);
    check(s.hr[10] === 125 && s.hr[150] === 170, `${name}: FC ${s.hr[10]}/${s.hr[150]}`);
    check(s.cadence[10] === 85 && s.cadence[150] === 95, `${name}: cadencia ${s.cadence[10]}/${s.cadence[150]}`);
    check(s.speed[10] != null && Math.abs((s.speed[10] as number) - 30) < 0.3, `${name}: velocidad ${s.speed[10]} (esperada ~30 km/h)`);
    check(s.altitude[10] != null && Math.abs((s.altitude[10] as number) - 100) < 1, `${name}: altitud ${s.altitude[10]} (esperada ~100 m)`);
  }
  // Salida larga: el paso crece para no pasar de ~2200 puntos
  check(stepFor(3 * 3600) === 5 && stepFor(6 * 3600) === 10 && stepFor(12 * 3600) === 20, `paso para salidas largas: ${stepFor(3 * 3600)}/${stepFor(6 * 3600)}/${stepFor(12 * 3600)}`);
  // Huecos: sin dato en un tramo queda null y no 0
  const b = bucketSamples([
    { t: 0, power: 100, hr: null, cadence: null, speed: null, altitude: null },
    { t: 5000, power: null, hr: null, cadence: null, speed: null, altitude: null },
    { t: 10000, power: 200, hr: null, cadence: null, speed: null, altitude: null },
  ], 5);
  check(b?.power[0] === 100 && b?.power[1] === null && b?.power[2] === 200 && b?.hr.every((v) => v === null), `huecos: ${JSON.stringify(b?.power)}`);
  console.log(problems === 0 ? "Series: todo bien" : `${problems} fallas`);
  process.exit(problems ? 1 : 0);
})();
