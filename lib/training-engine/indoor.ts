import type { WorkoutBlock } from "./tss";
import { VARIANTS } from "./variants";

/** Tope práctico de duración en rodillo (criterio propio: la sensación de esfuerzo y el calor limitan sesiones muy largas). */
export const INDOOR_MAX_MIN = 150;

export interface IndoorAdaptation {
  blocks: WorkoutBlock[];
  note: string;
  trimmedMin: number;
}

/**
 * Adapta una sesión de ruta a rodillo: se guarda la estructura y las potencias (el rodillo las sostiene mejor que la ruta)
 * y solo se acorta el tiempo de Z2 si la sesión supera ~150 min. No cambia la variante.
 * Fundamento de la nota: en interior la temperatura corporal sube más sin viento relativo, por eso se recomienda ventilador
 * fuerte y guiarse por la potencia y no por la frecuencia cardíaca (Junge 2016; evidencia fisiológica, no de rendimiento).
 */
export function adaptForIndoor(blocks: WorkoutBlock[], key: string): IndoorAdaptation {
  const total = blocks.reduce((s, b) => s + b.durationSec, 0);
  const cap = INDOOR_MAX_MIN * 60;
  let out = blocks.map((b) => ({ ...b }));
  let trimmed = 0;
  if (total > cap) {
    let excess = total - cap;
    // Se recorta primero el Z2 más largo (nunca intervalos, calentamiento ni vuelta a la calma)
    const idx = out
      .map((b, i) => ({ b, i }))
      .filter((x) => x.b.type === "z2" || x.b.type === "z2_fill")
      .sort((a, b) => b.b.durationSec - a.b.durationSec);
    for (const { i } of idx) {
      if (excess <= 0) break;
      const room = Math.max(0, out[i].durationSec - 20 * 60);
      const cut = Math.min(room, excess);
      out[i].durationSec -= cut;
      excess -= cut;
      trimmed += cut;
    }
    out = out.filter((b) => b.durationSec > 0);
  }
  const trimmedMin = Math.round(trimmed / 60);
  const v = VARIANTS[key];
  const parts = [
    "Rodillo: ventilador fuerte, hidratación y guiate por la potencia (la frecuencia cardíaca sube más adentro, sin efecto del viento)",
  ];
  if (trimmedMin > 0) parts.push(`se acortó el Z2 ${trimmedMin} min (tope práctico de ${INDOOR_MAX_MIN} min en rodillo)`);
  if (v?.indoor === "limited") parts.push("esta variante pierde parte de su sentido en rodillo; si podés, hacela en ruta otro día");
  return { blocks: out, note: parts.join(" · "), trimmedMin };
}
