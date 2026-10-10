import { buildBlocks } from "./block-builder";
import type { WorkoutBlock } from "./tss";
import { isOffBike } from "./off-bike";

const QUALITY = new Set(["hiit_genuino", "ronnestad_30_15", "z2_sprints", "billat_30_30", "rst", "sweet_spot", "umbral", "over_under", "vo2_long", "sprint_neuro", "endurance_tempo", "long_durability", "torque_low_cadence", "ftp_test", "ftp_test_5min", "ftp_test_8min"]);
const FILL = new Set(["z2", "z2_fill"]);

export interface ReadinessProposal {
  kind: "z2" | "trim";
  /** Texto para el botón/tarjeta */
  label: string;
  newKey: string;
  newBlocks: WorkoutBlock[];
}

const minutes = (b: WorkoutBlock[]) => Math.round(b.reduce((s, x) => s + x.durationSec, 0) / 60);

/** Recorta `pct` del volumen de Z2 (bloques z2/z2_fill) sin tocar calentamiento, series ni vuelta a la calma. */
function trimZ2(blocks: WorkoutBlock[], pct: number): WorkoutBlock[] | null {
  let changed = false;
  const out = blocks.map((b) => {
    if (!FILL.has(b.type)) return b;
    const d = Math.max(600, Math.round((b.durationSec * (1 - pct)) / 60) * 60);
    if (d >= b.durationSec) return b;
    changed = true;
    return { ...b, durationSec: d };
  });
  return changed ? out : null;
}

/**
 * Propuesta de ajuste de la sesión de hoy según el semáforo de disponibilidad.
 * - ROJO: una sesión de calidad pasa a Z2 de la misma duración; una de Z2 pierde 30% de volumen.
 * - ÁMBAR: se recorta ~20% del volumen de Z2 (la parte intensa no se toca).
 * Devuelve null si no hay nada razonable que proponer (gimnasio, descanso, GREEN).
 */
export function proposeReadinessAdjustment(
  status: "GREEN" | "AMBER" | "RED",
  stimulusType: string,
  blocks: WorkoutBlock[],
  ftp: number
): ReadinessProposal | null {
  if (status === "GREEN" || isOffBike(stimulusType)) return null;
  const total = minutes(blocks);

  if (status === "RED") {
    if (QUALITY.has(stimulusType)) {
      return { kind: "z2", label: `Cambiar la sesión de calidad por un rodaje Z2 de ${total} min`, newKey: "z2", newBlocks: buildBlocks("z2", total, ftp, null, null) };
    }
    const t = trimZ2(blocks, 0.3);
    return t ? { kind: "trim", label: `Recortar el rodaje 30% (de ${total} a ${minutes(t)} min)`, newKey: stimulusType, newBlocks: t } : null;
  }

  const t = trimZ2(blocks, 0.2);
  if (!t) return null;
  const tail = stimulusType === "z2" ? "" : " y mantener la parte intensa";
  return { kind: "trim", label: `Acortar el rodaje Z2 (de ${total} a ${minutes(t)} min)${tail}`, newKey: stimulusType, newBlocks: t };
}
