import type { WorkoutBlock } from "./tss";
import { VARIANTS } from "./variants";

/**
 * Tope de duración en rodillo (criterio del entrenador; también lo limitan el calor y la sensación de esfuerzo):
 * 90 min si la sesión tiene intervalos o sprints, 120 min si es rodaje sin trabajo de intensidad.
 * Una sesión más corta que el tope no se alarga ni se toca.
 */
export const INDOOR_CAP_QUALITY_MIN = 90;
export const INDOOR_CAP_ENDURANCE_MIN = 120;
/** Por encima de esto en rodillo se muestra un aviso suave (no bloquea). */
export const INDOOR_SOFT_WARN_MIN = 120;

/**
 * Rango del selector de duración al pasar a rodillo (minutos, de a 5):
 * mínimo = lo más corto que se puede dejar sin desarmar la sesión; máximo = la duración original (no se alarga);
 * inicial = el tope por defecto (90 con intervalos, 120 en rodaje) o la duración original si es menor.
 */
export function indoorDurationRange(blocks: WorkoutBlock[], key: string): { minMin: number; maxMin: number; defaultMin: number } {
  const orig = blocks.reduce((s, b) => s + b.durationSec, 0);
  const maxMin = Math.max(5, Math.ceil(orig / 300) * 5);
  const floorSec = adaptForIndoor(blocks, key, 1).blocks.reduce((s, b) => s + b.durationSec, 0);
  const minMin = Math.min(maxMin, Math.max(5, Math.ceil((floorSec + 60) / 300) * 5));
  const defaultMin = Math.min(maxMin, Math.max(minMin, indoorCapMin(blocks)));
  return { minMin, maxMin, defaultMin };
}

export function indoorCapMin(blocks: { type: string }[]): number {
  return blocks.some((b) => b.type === "interval") ? INDOOR_CAP_QUALITY_MIN : INDOOR_CAP_ENDURANCE_MIN;
}

export interface IndoorAdaptation {
  blocks: WorkoutBlock[];
  note: string;
  trimmedMin: number;
  removedReps: number;
  /** true si aun así no se pudo bajar del tope (se avisa en la nota). */
  overCap: boolean;
}

const sum = (bs: WorkoutBlock[]) => bs.reduce((s, b) => s + b.durationSec, 0);
const isWarm = (b: WorkoutBlock) => b.type.startsWith("warmup");
const isCool = (b: WorkoutBlock) => b.type.startsWith("cooldown");
const isWork = (b: WorkoutBlock) => b.type === "interval";
const isSep = (b: WorkoutBlock) => b.type === "recovery" || b.type === "z2";

/** Quita separadores (recuperaciones / Z2 entre series) que quedaron al final, al principio o repetidos. */
function tidy(blocks: WorkoutBlock[]): WorkoutBlock[] {
  const out: WorkoutBlock[] = [];
  for (const b of blocks) {
    const prev = out[out.length - 1];
    if (isSep(b) && prev && isSep(prev) && prev.type === b.type) { prev.durationSec = Math.max(prev.durationSec, b.durationSec); continue; }
    out.push(b);
  }
  // separador pegado a la vuelta a la calma o relleno sin trabajo antes
  const res: WorkoutBlock[] = [];
  out.forEach((b, i) => {
    if (isSep(b)) {
      const before = res.slice().reverse().find((x) => !isSep(x));
      const after = out.slice(i + 1).find((x) => !isSep(x));
      if (!before || !isWork(before) || !after || !isWork(after)) return;
    }
    res.push(b);
  });
  return res;
}

/**
 * Adapta una sesión de ruta a rodillo con un tope de 90 min (120 si es rodaje sin intervalos). Se conserva la variante, el tipo de trabajo y las potencias;
 * para entrar en el tope se recorta en este orden:
 *  1) el relleno de Z2, los Z2 largos (hasta 20 min cada uno) y el Z2 entre series (hasta 8 min): primero se cuida el estímulo;
 *  2) repeticiones o series del final (sin bajar de la mitad ni de 2 repeticiones);
 *  3) calentamiento y vuelta a la calma (mínimo 12 y 6 min);
 *  4) intervalos largos (≥ 20 min), hasta 15 min, con la misma potencia.
 * Si aun así no entra, se deja y se avisa en la nota.
 * Fundamento de la nota: en interior la temperatura corporal sube más sin viento relativo, por eso se recomienda ventilador
 * fuerte y guiarse por la potencia y no por la frecuencia cardíaca (Junge 2016; evidencia fisiológica, no de rendimiento).
 */
export function adaptForIndoor(blocks: WorkoutBlock[], key: string, capMinOverride?: number): IndoorAdaptation {
  // capMinOverride = duración elegida por el entrenador/atleta (el tope por defecto es solo el valor inicial)
  const capMin = capMinOverride && capMinOverride > 0 ? Math.round(capMinOverride) : indoorCapMin(blocks);
  const cap = capMin * 60;
  let out = blocks.map((b) => ({ ...b }));
  const originalTotal = sum(out);
  let removedReps = 0;
  let shortened = 0;

  if (originalTotal > cap) {
    // 1) Z2 más largo primero (el relleno puede llegar a 0)
    let excess = originalTotal - cap;
    const idx = out
      .map((b, i) => ({ b, i }))
      .filter((x) => x.b.type === "z2" || x.b.type === "z2_fill")
      .sort((a, b) => b.b.durationSec - a.b.durationSec);
    for (const { i } of idx) {
      if (excess <= 0) break;
      // El Z2 entre series (pegado a trabajo) puede bajar hasta 8 min antes de tocar una sola repetición; el rodaje largo, hasta 20
      const between = out[i].type === "z2" && out.slice(0, i).some(isWork) && out.slice(i + 1).some(isWork);
      const floor = out[i].type === "z2_fill" ? 0 : between ? 8 * 60 : 20 * 60;
      const cut = Math.min(Math.max(0, out[i].durationSec - floor), excess);
      out[i].durationSec -= cut;
      excess -= cut;
    }
    out = out.filter((b) => b.durationSec > 0);

    // 2) Repeticiones del final
    const totalReps = out.filter(isWork).length;
    const minReps = Math.min(totalReps, Math.max(2, Math.ceil(totalReps / 2)));
    while (sum(out) > cap) {
      const works = out.map((b, i) => ({ b, i })).filter((x) => isWork(x.b));
      if (works.length <= minReps) break;
      const j = works[works.length - 1].i;
      // pares under/over: intervalos pegados se quitan juntos para no dejar un ciclo a medias
      const pair = j > 0 && isWork(out[j - 1]);
      const from = pair ? j - 1 : j;
      const count = pair ? 2 : 1;
      if (works.length - count < minReps) break;
      out.splice(from, count);
      removedReps += count;
      out = tidy(out);
    }

    // 3) Calentamiento y vuelta a la calma
    if (sum(out) > cap) {
      const shrink = (pred: (b: WorkoutBlock) => boolean, minSec: number) => {
        const idxs = out.map((b, i) => ({ b, i })).filter((x) => pred(x.b));
        const tot = idxs.reduce((s, x) => s + x.b.durationSec, 0);
        const want = Math.max(minSec, tot - (sum(out) - cap));
        if (!idxs.length || want >= tot) return;
        const k = want / tot;
        idxs.forEach((x) => { out[x.i].durationSec = Math.max(60, Math.floor((x.b.durationSec * k) / 30) * 30); });
      };
      shrink(isWarm, 12 * 60);
      if (sum(out) > cap) shrink(isCool, 6 * 60);
    }

    // 4) Último recurso: acortar los intervalos largos (≥ 20 min) hasta un mínimo de 15 min, manteniendo la potencia
    if (sum(out) > cap) {
      let over = sum(out) - cap;
      const longs = out.map((b, i) => ({ b, i })).filter((x) => isWork(x.b) && x.b.durationSec >= 20 * 60);
      for (const x of longs) {
        if (over <= 0) break;
        const share = Math.ceil(over / longs.length / 60) * 60;
        const cut = Math.min(Math.max(0, x.b.durationSec - 15 * 60), share);
        out[x.i].durationSec -= cut;
        over -= cut;
        shortened += cut;
      }
    }
  }

  const total = sum(out);
  const trimmedMin = Math.round((originalTotal - total) / 60);
  const overCap = total > cap;
  const v = VARIANTS[key];
  const parts = [
    "Rodillo: ventilador fuerte, hidratación y guiate por la potencia (la frecuencia cardíaca sube más adentro, sin efecto del viento)",
  ];
  if (trimmedMin > 0) {
    parts.push(
      `se acortó ${trimmedMin} min para entrar en el tope de ${capMin} min en rodillo` +
        (removedReps > 0 ? ` (${removedReps} ${removedReps === 1 ? "repetición menos" : "repeticiones menos"})` : "")
    );
  }
  if (shortened > 0) parts.push(`los intervalos largos se acortaron ${Math.round(shortened / 60)} min en total (misma potencia)`);
  if (overCap) parts.push(`no se pudo bajar de ${capMin} min sin desarmar la sesión: dura ${Math.round(total / 60)} min`);
  if (capMinOverride && total > INDOOR_SOFT_WARN_MIN * 60) parts.push(`dura ${Math.round(total / 60)} min en rodillo: suele costar más sostenerlo (calor, posición fija); cortá si hace falta`);
  if (v?.indoor === "limited") parts.push("esta variante pierde parte de su sentido en rodillo; si podés, hacela en ruta otro día");
  return { blocks: out, note: parts.join(" · "), trimmedMin, removedReps, overCap };
}
