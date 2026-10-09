/** Percepción del atleta tras la salida, con las escalas de Intervals.icu: RPE 1–10 y sensación 1–5 (1 = fuerte … 5 = sin fuerzas). */
export const RPE_LABELS: Record<number, string> = {
  1: "Nada", 2: "Muy fácil", 3: "Fácil", 4: "Cómodo", 5: "Algo exigente",
  6: "Difícil", 7: "Duro", 8: "Muy duro", 9: "Extremo", 10: "Máximo",
};
export const FEEL_LABELS: Record<number, string> = { 1: "Fuerte", 2: "Bien", 3: "Normal", 4: "Flojo", 5: "Sin fuerzas" };

export const validRpe = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 10;
export const validFeel = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;

/** Texto corto para la IA y el mail; null si no hay ninguno de los dos datos. */
export function describeRatings(rpe: number | null | undefined, feel: number | null | undefined): string | null {
  const parts: string[] = [];
  if (validRpe(rpe)) parts.push(`RPE ${rpe}/10 (${RPE_LABELS[rpe].toLowerCase()})`);
  if (validFeel(feel)) parts.push(`sensación: ${FEEL_LABELS[feel].toLowerCase()}`);
  return parts.length ? parts.join(", ") : null;
}
