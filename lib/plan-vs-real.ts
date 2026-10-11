import type { SustainedEffort } from "./laps";

interface PlanBlock {
  type: string;
  durationSec: number;
  targetWatts: number;
}

const NOT_WORK = (t: string) => t.startsWith("warmup") || t.startsWith("cooldown") || t === "recovery" || t === "z2" || t === "z2_fill";
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const min = (s: number) => `${Math.round(s / 60)} min`;

/** Tramos del plan a ≥ minPct del FTP: bloques de trabajo contiguos se unen (la recuperación corta el tramo). */
export function plannedHardStretches(blocks: PlanBlock[], ftp: number, minPct = 0.9): { durSec: number; maxW: number }[] {
  const out: { durSec: number; maxW: number }[] = [];
  let cur: { durSec: number; maxW: number } | null = null;
  for (const b of blocks) {
    const hard = !NOT_WORK(b.type) && b.targetWatts >= minPct * ftp && b.durationSec > 0;
    if (hard) {
      if (!cur) { cur = { durSec: 0, maxW: 0 }; out.push(cur); }
      cur.durSec += b.durationSec;
      cur.maxW = Math.max(cur.maxW, b.targetWatts);
    } else cur = null;
  }
  return out;
}

/**
 * Compara, con cuentas en código, el trabajo a ≥ 90% del FTP que había en el plan con los tramos sostenidos detectados en la potencia real.
 * No alinea en el tiempo (la salida puede tener otro calentamiento): compara tiempo total, cantidad e intensidad máxima.
 */
export function comparePlanVsReal(blocks: PlanBlock[], efforts: SustainedEffort[], ftp: number): string {
  const thr = Math.round(0.9 * ftp);
  const stretches = plannedHardStretches(blocks, ftp);
  const planTotal = stretches.reduce((s, x) => s + x.durSec, 0);
  const planLongest = Math.max(0, ...stretches.map((x) => x.durSec));
  const planMaxW = Math.max(0, ...stretches.map((x) => x.maxW));
  const detTotal = efforts.reduce((s, e) => s + e.durSec, 0);
  const longest = efforts.reduce<SustainedEffort | null>((b, e) => (!b || e.durSec > b.durSec ? e : b), null);
  const strongest = efforts.reduce<SustainedEffort | null>((b, e) => (!b || e.avgW > b.avgW ? e : b), null);
  const pct = (w: number) => Math.round((w / ftp) * 100);
  const detail = longest && strongest ? `el más largo ${mmss(longest.durSec)} a ${longest.avgW} W (${pct(longest.avgW)}% del FTP) y el más fuerte ${strongest.avgW} W (${pct(strongest.avgW)}% del FTP)` : "";
  const head = "Plan vs esfuerzos detectados (calculado por código, usalo tal cual; sin alinear en el tiempo): ";

  if (stretches.length === 0) {
    if (detTotal < 180) return `${head}el plan no tenía trabajo a ≥ 90% del FTP (${thr} W) y no se detectaron tramos sostenidos a esa intensidad: sin desvío de intensidad.`;
    return `${head}el plan NO tenía trabajo a ≥ 90% del FTP (${thr} W) y se detectaron ${efforts.length} tramo${efforts.length === 1 ? "" : "s"} sostenido${efforts.length === 1 ? "" : "s"} (${min(detTotal)} en total; ${detail}): esfuerzos FUERA de lo planeado.`;
  }
  const planTxt = `el plan tenía ${stretches.length} tramo${stretches.length === 1 ? "" : "s"} a ≥ 90% del FTP (${min(planTotal)} en total, hasta ${planMaxW} W)`;
  if (planLongest < 90) {
    return `${head}${planTxt}, pero son intervalos cortos (el más largo ${mmss(planLongest)}); el detector junta los cortes de hasta 20 s y no los separa: ${efforts.length === 1 ? "se detectó 1 tramo" : `se detectaron ${efforts.length} tramos`} (${min(detTotal)} en total). No compares cantidades, solo el orden de magnitud del tiempo.`;
  }
  if (efforts.length === 0) return `${head}${planTxt} y no se detectó ningún tramo sostenido a esa intensidad: lo planeado no se ve en la potencia.`;
  const diff = detTotal - planTotal;
  let verdict = "tiempo a esa intensidad similar al planeado";
  if (detTotal > 1.5 * planTotal && diff >= 180) verdict = `MÁS trabajo a esa intensidad que el planeado (${min(detTotal)} vs ${min(planTotal)})`;
  else if (detTotal < 0.6 * planTotal && -diff >= 180) verdict = `MENOS trabajo a esa intensidad que el planeado (${min(detTotal)} vs ${min(planTotal)})`;
  const over = strongest && strongest.avgW > planMaxW * 1.08 ? ` El tramo más fuerte (${strongest.avgW} W) supera en más de 8% la potencia máxima planeada (${planMaxW} W).` : "";
  return `${head}${planTxt}; ${efforts.length === 1 ? "se detectó 1 tramo" : `se detectaron ${efforts.length} tramos`} (${min(detTotal)} en total; ${detail}): ${verdict}.${over}`;
}
