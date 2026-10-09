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

// ── Lectura del RPE frente a la carga real (cuentas en código, la IA no compara números) ──────────

/** IF como razón (la base a veces lo guarda como porcentaje, p. ej. 72,58). */
export const ifRatio = (v: number | null | undefined): number | null => (v == null || !Number.isFinite(v) ? null : v > 3 ? v / 100 : v);

/** Rango de RPE habitual para una sesión de ese IF. Criterio PRÁCTICO del sistema (no sale de un estudio): sirve solo para detectar desvíos grandes. */
export function expectedRpeBand(ifr: number): [number, number] {
  if (ifr < 0.65) return [1, 3];
  if (ifr < 0.75) return [2, 4];
  if (ifr < 0.85) return [4, 6];
  if (ifr < 0.95) return [6, 8];
  return [7, 10];
}
const bandMid = (b: [number, number]) => (b[0] + b[1]) / 2;

export interface RatedSession { rpe: number; feel: number | null; ifr: number | null; label: string }

export interface RatingReadingInput {
  rpe: number | null | undefined;
  feel: number | null | undefined;
  durationMin: number;
  intensityFactor: number | null | undefined;
  variabilityIndex: number | null | undefined;
  prior: RatedSession[]; // sesiones anteriores con RPE, de la más reciente a la más vieja
}

const fmt = (n: number, d = 1) => n.toFixed(d).replace(".", ",");

/** Líneas de contexto con la lectura ya calculada. Devuelve [] si no hay RPE ni sensación. */
export function readRatings(i: RatingReadingInput): string[] {
  const out: string[] = [];
  const rpe = validRpe(i.rpe) ? i.rpe : null;
  const feel = validFeel(i.feel) ? i.feel : null;
  const ifr = ifRatio(i.intensityFactor);

  if (rpe != null) {
    out.push(`Carga session-RPE (RPE × minutos, método de Foster): ${Math.round(rpe * i.durationMin)} u.a. Es una escala propia, NO comparable con el TSS.`);
    if (ifr != null) {
      const band = expectedRpeBand(ifr);
      const where = rpe < band[0] ? "MÁS BAJO" : rpe > band[1] ? "MÁS ALTO" : "DENTRO del rango habitual";
      out.push(`RPE vs carga (calculado): con IF ${fmt(ifr, 2)} lo habitual es un RPE de ${band[0]} a ${band[1]}; el de esta sesión (${rpe}) está ${where}. [PRÁCTICA, rango aproximado del sistema, no de un estudio]`);
      const withIf = i.prior.filter((p) => p.ifr != null);
      if (withIf.length >= 3) {
        const resid = (r: number, f: number) => r - bandMid(expectedRpeBand(f));
        const prev = withIf.slice(0, 5);
        const avg = prev.reduce((s, p) => s + resid(p.rpe, p.ifr as number), 0) / prev.length;
        const diff = resid(rpe, ifr) - avg;
        const trend = diff >= 2 ? "claramente MÁS ALTO que en sus últimas sesiones a carga parecida (posible señal de fatiga: confirmala con FC de reposo, HRV o bienestar antes de sacar conclusiones)" : diff <= -2 ? "claramente MÁS BAJO que en sus últimas sesiones a carga parecida" : "en línea con sus últimas sesiones a carga parecida";
        out.push(`Tendencia (calculada con ${prev.length} sesiones anteriores con RPE): el RPE de hoy está ${trend}.`);
      } else {
        out.push(`Tendencia: hay ${withIf.length} sesiones anteriores con RPE; con menos de 3 no se puede hablar de tendencia, un solo dato es un dato.`);
      }
    }
    if (i.variabilityIndex != null && i.variabilityIndex >= 1.25) {
      out.push(`Aviso: la sesión fue muy variable (VI ${fmt(i.variabilityIndex, 2)}). El RPE es UN número para toda la sesión: promedia los tramos suaves con los esfuerzos cortos, así que un RPE bajo NO prueba que los esfuerzos hayan sido fáciles ni que sobre margen.`);
    }
  }
  if (feel != null) {
    out.push(feel >= 4 ? `Sensación «${FEEL_LABELS[feel].toLowerCase()}»: es un dato a vigilar si se repite en varias sesiones; una sola no define nada.` : `Sensación «${FEEL_LABELS[feel].toLowerCase()}»: no hay señal de alarma en este dato.`);
  }
  if (rpe != null && feel != null && ifr != null && feel >= 4 && rpe <= expectedRpeBand(ifr)[1]) {
    out.push("Combinación a mencionar con cuidado: sensación floja con un RPE no alto (el esfuerzo no se sintió exagerado, pero las piernas no respondieron).");
  }
  return out;
}
