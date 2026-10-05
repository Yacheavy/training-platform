export type DeviationFlag = "NONE" | "HARDER_THAN_PLANNED" | "EASIER_THAN_PLANNED";

export interface DeviationResult {
  flag: DeviationFlag;
  notes: string | null;
}

/**
 * Compara lo planeado vs. lo real de una sesión. Necesita que la actividad
 * tenga un plannedTss asociado (viene de haber sido generada por el
 * motor de sugerencia, Fase 7) — si no lo tiene, no hay nada que comparar.
 *
 * Umbrales:
 * - Desvío de TSS >25% en cualquier dirección → posible desvío real
 *   (umbral HEURÍSTICO de práctica, no validado en la literatura)
 * - Decoupling >10% (solo es interpretable en sesiones continuas Z2/sweet spot;
 *   en intervalos la FC no se estabiliza y el desacople no significa lo mismo) → señal adicional de que costó más de lo esperado,
 *   aunque el TSS haya salido similar al plan (ver investigación:
 *   decoupling >10% es el umbral fuerte, no el de 5%)
 */
export function detectPlanDeviation(activity: {
  tss: number | null;
  plannedTss: number | null;
  decouplingPct: number | null;
}): DeviationResult {
  if (!activity.plannedTss || !activity.tss) {
    return { flag: "NONE", notes: "Sin plan asociado para comparar" };
  }

  const pctDiff = ((activity.tss - activity.plannedTss) / activity.plannedTss) * 100;
  const highDecoupling = (activity.decouplingPct ?? 0) > 10;

  if (pctDiff > 25 || (pctDiff > 10 && highDecoupling)) {
    return {
      flag: "HARDER_THAN_PLANNED",
      notes: `TSS real ${activity.tss} vs planeado ${activity.plannedTss} (${pctDiff.toFixed(0)}%)${highDecoupling ? `, desacople ${activity.decouplingPct?.toFixed(1)}%` : ""}`,
    };
  }

  if (pctDiff < -25) {
    return {
      flag: "EASIER_THAN_PLANNED",
      notes: `TSS real ${activity.tss} vs planeado ${activity.plannedTss} (${pctDiff.toFixed(0)}%)`,
    };
  }

  return { flag: "NONE", notes: null };
}