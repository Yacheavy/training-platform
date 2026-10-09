/**
 * Autorregulación (Fase 2): ajusta la progresión y protege la distribución de intensidad según lo REALMENTE ejecutado.
 * Módulo puro, determinista y explicable. Todos los umbrales son heurísticas de práctica (no validadas en ensayos)
 * y se rotulan así en la interfaz. Los ajustes son acotados (±1 escalón) para que un dato ruidoso no desarme el plan.
 */
import { VARIANTS } from "./variants";
import { CONTINUOUS_KEYS } from "./deviation";

export interface ExecutionRecord {
  key: string;
  /** Fecha de la sesión (ms epoch) para ordenar. */
  at: number;
  /** TSS real / TSS planeado (null si no hay datos). */
  tssRatio: number | null;
  deviation: "NONE" | "HARDER_THAN_PLANNED" | "EASIER_THAN_PLANNED";
  decouplingPct: number | null;
}

export interface ProgressionAdjust {
  /** -1 = repetir el escalón anterior · 0 = según calendario · +1 = un escalón más */
  adjust: -1 | 0 | 1;
  reason: string;
  /** Sesiones consideradas. */
  n: number;
}

/** Claves cuyo desacople Pw:HR es interpretable (sesiones continuas, no intervalos cortos). */
const CONTINUOUS = CONTINUOUS_KEYS;

const struggled = (r: ExecutionRecord) =>
  (r.tssRatio != null && r.tssRatio < 0.8) || (r.deviation === "HARDER_THAN_PLANNED" && CONTINUOUS.has(r.key) && (r.decouplingPct ?? 0) > 10);

const wentWell = (r: ExecutionRecord, key: string) =>
  r.tssRatio != null &&
  r.tssRatio >= 0.9 &&
  r.tssRatio <= 1.15 &&
  (!CONTINUOUS.has(key) || r.decouplingPct == null || r.decouplingPct <= 7) &&
  !(r.deviation === "HARDER_THAN_PLANNED" && CONTINUOUS.has(key) && (r.decouplingPct ?? 0) > 10);

/**
 * Por variante (solo las que progresan): mira las últimas ejecuciones de esa variante.
 * - 2 de las últimas 2 con problemas (TSS <80% de lo planeado, o más duras con desacople >10%) → repetir el escalón anterior.
 * - 3 de las últimas 3 bien (TSS 90–115%, desacople ≤7% en sesiones continuas) → un escalón más.
 * - cualquier otro caso → según calendario. Con menos de 2 ejecuciones no se ajusta nada.
 */
export function progressionAdjustments(records: ExecutionRecord[], keys?: string[]): Record<string, ProgressionAdjust> {
  const out: Record<string, ProgressionAdjust> = {};
  const byKey = new Map<string, ExecutionRecord[]>();
  for (const r of records) byKey.set(r.key, [...(byKey.get(r.key) ?? []), r]);
  for (const [key, list] of byKey) {
    if (keys && !keys.includes(key)) continue;
    const label = VARIANTS[key]?.label ?? key;
    const sorted = [...list].sort((a, b) => a.at - b.at);
    const last2 = sorted.slice(-2);
    const last3 = sorted.slice(-3);
    if (sorted.length >= 2 && last2.every(struggled)) {
      out[key] = { adjust: -1, n: last2.length, reason: `Las últimas 2 sesiones de ${label} te costaron más de lo planeado o quedaron cortas: se repite el escalón anterior (criterio de práctica)` };
    } else if (sorted.length >= 3 && last3.every((r) => wentWell(r, key))) {
      out[key] = { adjust: 1, n: last3.length, reason: `Las últimas 3 sesiones de ${label} salieron como estaban planeadas: se sube un escalón antes de lo que marca el calendario (criterio de práctica)` };
    } else {
      out[key] = { adjust: 0, n: sorted.length, reason: sorted.length < 2 ? "Sin suficientes ejecuciones para ajustar" : "Progresión según calendario" };
    }
  }
  return out;
}

export interface ZoneHours {
  lowH: number; // Z1–Z2
  midH: number; // Z3–Z4
  highH: number; // Z5–Z7
}

export interface IntensityGuard {
  /** El segundo estímulo de calidad pasa a rodaje fácil. */
  dropSecondary: boolean;
  /** No se programan variantes de intensidad media (tempo, sweet spot) fuera del estímulo principal. */
  avoidMid: boolean;
  /** Días (desde hoy) durante los que aplica. */
  days: number;
  reason: string;
}

export const MIN_GUARD_HOURS = 4;
export const GUARD_HIGH_SHARE = 0.2;
export const GUARD_MID_SHARE = 0.3;

/**
 * Protección de la distribución de intensidad con el tiempo REAL en zonas de los últimos 14 días:
 * - Más del 20% del tiempo en Z5–Z7 → se saca el segundo estímulo. Umbral de PRÁCTICA: la referencia de Seiler (~20% de alta intensidad) es de SESIONES, no de tiempo en zona, así que no es equivalente.
 * - Más del 30% en Z3–Z4 ("zona gris"): se evitan variantes de intensidad media fuera del estímulo principal.
 * Con menos de 4 h registradas no se decide nada (el porcentaje sería ruido).
 */
export function intensityGuard(z: ZoneHours): IntensityGuard | null {
  const total = z.lowH + z.midH + z.highH;
  if (total < MIN_GUARD_HOURS) return null;
  const high = z.highH / total;
  const mid = z.midH / total;
  const dropSecondary = high > GUARD_HIGH_SHARE;
  const avoidMid = mid > GUARD_MID_SHARE;
  if (!dropSecondary && !avoidMid) return null;
  const parts: string[] = [];
  if (dropSecondary) parts.push(`${Math.round(high * 100)}% del tiempo de los últimos 14 días en Z5–Z7 (>20%): el segundo día de calidad pasa a rodaje fácil`);
  if (avoidMid) parts.push(`${Math.round(mid * 100)}% en Z3–Z4 (>30%): se evitan variantes de intensidad media fuera del estímulo principal`);
  return { dropSecondary, avoidMid, days: 14, reason: `Ajuste por distribución real: ${parts.join("; ")} (heurística de práctica)` };
}

/** Variantes de intensidad media que `avoidMid` saca de los roles que no son el principal. */
export const MID_INTENSITY_KEYS = ["endurance_tempo", "sweet_spot", "over_under"] as const;
