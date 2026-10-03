/**
 * Ratio carga externa/interna: TSS por unidad de TRIMP.
 * Según Sanders et al. 2018, este ratio cambia poco en atletas
 * bien adaptados y de forma triv-a-pequeña incluso bajo fatiga
 * acumulada en Grand Tours — por eso NO es una alarma aislada,
 * es una tendencia a mirar junto con EF y decoupling.
 *
 * Interpretación:
 * - Ratio ESTABLE en el tiempo (misma sesión, mismo esfuerzo real) = normal
 * - Ratio que CAE (más TRIMP por el mismo TSS = más pulsaciones
 *   por el mismo trabajo mecánico) = posible fatiga acumulada o calor
 * - Ratio que SUBE = posible mejora de eficiencia aeróbica real
 */
export function calculateLoadRatio(tss: number | null, trimp: number | null): number | null {
  if (!tss || !trimp || trimp === 0) return null;
  return Math.round((tss / trimp) * 100) / 100;
}

export interface LoadTrendPoint {
  date: Date;
  ratio: number;
  efficiencyFactor: number | null;
  decouplingPct: number | null;
}

/**
 * Arma la serie temporal del ratio + EF + decoupling para un tipo de
 * estímulo específico, para poder ver la TENDENCIA (nunca un valor aislado).
 */
export function buildLoadTrend(
  activities: {
    date: Date;
    tss: number | null;
    trimp: number | null;
    efficiencyFactor: number | null;
    decouplingPct: number | null;
  }[]
): LoadTrendPoint[] {
  return activities
    .map((a) => {
      const ratio = calculateLoadRatio(a.tss, a.trimp);
      if (ratio === null) return null;
      return {
        date: a.date,
        ratio,
        efficiencyFactor: a.efficiencyFactor,
        decouplingPct: a.decouplingPct,
      };
    })
    .filter((p): p is LoadTrendPoint => p !== null);
}