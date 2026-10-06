/**
 * Asignación de estímulos a los días de calidad de una semana.
 *
 * Para el objetivo VO2max aplica las reglas de la base de conocimiento:
 * - Máx. 1 sesión de HIIT genuino por semana (cupo del estímulo principal).
 * - El segundo día de calidad es un rodaje Z2 con sprints (Rønnestad 2020), máx. 1 por semana.
 *   (Rønnestad 30/15 sigue disponible como plantilla/chat, pero ya no es la alternativa por defecto).
 * - Entre dos sesiones de VO2max debe haber al menos 48h (2 días de distancia,
 *   contando la semana de forma circular). Los días de calidad que no cumplen
 *   esa separación pasan a Z2 (modelo 80/20: la mayoría del volumen es Z2).
 *
 * Para otros objetivos conserva el comportamiento anterior: el principal
 * hasta su cupo semanal y el resto alternativa.
 */
export const OBJECTIVE_TO_STIMULUS: Record<string, string> = {
  vo2max: "hiit_genuino",
  umbral: "umbral",
  base: "sweet_spot",
  tapering: "z2",
};

export const ALTERNATIVE_TO_STIMULUS: Record<string, string> = {
  vo2max: "z2_sprints", // un solo VO2max por semana; el segundo estímulo es un rodaje Z2 con sprints (baja fatiga)
  umbral: "sweet_spot",
  base: "z2",
  tapering: "z2",
};

export const MIN_GAP_DAYS_BETWEEN_VO2MAX = 2;

/** Opciones del estímulo de VO2max que puede elegir el atleta (objetivo VO2max). */
export const VO2_STIMULUS_OPTIONS = ["hiit_genuino", "ronnestad_30_15", "alternate"] as const;

/**
 * Estímulo principal de la semana. Para el objetivo VO2max respeta la preferencia del atleta
 * (HIIT genuino, Rønnestad 30/15 o alternar semanas: pares HIIT, impares Rønnestad); el resto
 * de objetivos usa el mapa por defecto.
 */
export function primaryStimulusFor(objective: string, vo2Stimulus: string | null | undefined, weekIndex: number): string {
  const base = OBJECTIVE_TO_STIMULUS[objective] ?? "sweet_spot";
  if (objective !== "vo2max") return base;
  if (vo2Stimulus === "ronnestad_30_15") return "ronnestad_30_15";
  if (vo2Stimulus === "alternate") return weekIndex % 2 === 1 ? "ronnestad_30_15" : "hiit_genuino";
  return "hiit_genuino";
}

function circularGapDays(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 7 - d);
}

/** qualityDays: dayOfWeek (0-6) de cada slot de calidad, en orden. */
export function assignWeeklyQualityStimuli(
  qualityDays: number[],
  objective: string,
  primaryMaxPerWeek: number | null,
  primaryOverride?: string
): string[] {
  const primary = primaryOverride ?? OBJECTIVE_TO_STIMULUS[objective] ?? "sweet_spot";
  const alternative = ALTERNATIVE_TO_STIMULUS[objective] ?? "sweet_spot";
  // VO2max: un solo estímulo de VO2max por semana (sea HIIT genuino o Rønnestad)
  const cap = objective === "vo2max" ? 1 : (primaryMaxPerWeek ?? qualityDays.length);

  if (objective !== "vo2max") {
    return qualityDays.map((_, i) => (i < cap ? primary : alternative));
  }

  const hardDays: number[] = [];
  let primaries = 0;
  let alternatives = 0;
  return qualityDays.map((day) => {
    const spaced = hardDays.every((d) => circularGapDays(d, day) >= MIN_GAP_DAYS_BETWEEN_VO2MAX);
    if (!spaced) return "z2";
    if (primaries < cap) {
      primaries++;
      hardDays.push(day);
      return primary;
    }
    if (alternatives < 1) {
      alternatives++;
      hardDays.push(day);
      return alternative;
    }
    return "z2";
  });
}
