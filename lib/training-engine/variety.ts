import { VARIANTS, intensityOf, isNeuroKey } from "./variants";

/**
 * Selector de variantes con rotación (módulo puro, determinista y explicable).
 *
 * Idea: cada "rol" de sesión (calidad principal, calidad secundaria, rodaje, salida larga) tiene un
 * conjunto de variantes posibles con un reparto objetivo según el nivel de variedad. Para cada día se
 * elige la variante MÁS ATRASADA respecto de su reparto en las últimas 4 semanas (déficit), después de
 * aplicar las reglas duras: vetadas por el atleta, duración mínima, máximo semanal, separación entre
 * repeticiones, descarga y "día después de una sesión dura". Así la rotación continúa entre planes
 * porque lee el historial, y cada elección se puede explicar ("hace 3 semanas que no hacés X").
 */
export type VarietyLevel = "conservative" | "balanced" | "varied";
export type SlotRole = "primary" | "secondary" | "volume" | "long";

export interface HistoryEntry {
  /** Día relativo al día 0 del plan (negativo = antes del plan). */
  dayOffset: number;
  key: string;
}

export const VARIETY_LEVELS: VarietyLevel[] = ["conservative", "balanced", "varied"];
export const VARIETY_LABELS: Record<VarietyLevel, string> = {
  conservative: "Conservador",
  balanced: "Equilibrado",
  varied: "Variado",
};
export const normalizeLevel = (v: string | null | undefined): VarietyLevel => (VARIETY_LEVELS.includes(v as VarietyLevel) ? (v as VarietyLevel) : "balanced");

interface PoolEntry {
  key: string;
  /** Reparto objetivo por nivel: [conservador, equilibrado, variado] */
  w: [number, number, number];
}

const WINDOW_DAYS = 28;

const LEVEL_INDEX: Record<VarietyLevel, 0 | 1 | 2> = { conservative: 0, balanced: 1, varied: 2 };

/** Pool de variantes para un rol, según el objetivo del bloque y la preferencia de VO2max. */
export function poolFor(objective: string, role: SlotRole, vo2Stimulus: string | null | undefined, weekIndex: number): PoolEntry[] {
  const E = (key: string, c: number, b: number, v: number): PoolEntry => ({ key, w: [c, b, v] });

  if (role === "primary") {
    if (objective === "vo2max") {
      if (vo2Stimulus === "hiit_genuino") return [E("hiit_genuino", 1, 1, 1)];
      if (vo2Stimulus === "ronnestad_30_15") return [E("ronnestad_30_15", 1, 1, 1)];
      if (vo2Stimulus === "alternate") return [E(weekIndex % 2 === 1 ? "ronnestad_30_15" : "hiit_genuino", 1, 1, 1)];
      if (vo2Stimulus === "rotate") return [E("hiit_genuino", 0.4, 0.4, 0.35), E("ronnestad_30_15", 0.4, 0.4, 0.35), E("vo2_long", 0.2, 0.2, 0.3)];
      // Sin preferencia explícita: conservador mantiene el HIIT genuino de siempre; los demás rotan
      return [E("hiit_genuino", 1, 0.4, 0.35), E("ronnestad_30_15", 0, 0.4, 0.35), E("vo2_long", 0, 0.2, 0.3)];
    }
    if (objective === "umbral") return [E("umbral", 1, 0.65, 0.5), E("over_under", 0, 0.35, 0.5)];
    // base (y cualquier otro): sweet spot como eje; tempo y torque como variedad
    return [E("sweet_spot", 1, 0.55, 0.45), E("endurance_tempo", 0, 0.35, 0.35), E("torque_low_cadence", 0, 0.1, 0.2)];
  }

  if (role === "secondary") {
    if (objective === "vo2max") return [E("z2_sprints", 1, 0.6, 0.5), E("sprint_neuro", 0, 0.4, 0.5)];
    if (objective === "umbral") return [E("sweet_spot", 1, 0.7, 0.55), E("sprint_neuro", 0, 0.15, 0.2), E("z2_sprints", 0, 0.15, 0.25)];
    return [E("z2", 1, 0.4, 0.25), E("z2_progressive", 0, 0.3, 0.3), E("sprint_neuro", 0, 0.15, 0.2), E("z2_sprints", 0, 0.15, 0.25)];
  }

  // Rodajes (volumen) y salida larga
  const tempoW: [number, number, number] = objective === "vo2max" ? [0, 0.1, 0.15] : objective === "umbral" ? [0, 0.25, 0.35] : [0, 0.2, 0.3];
  if (role === "long") {
    return [E("z2", 0.85, 0.5, 0.35), E("z2_progressive", 0.15, 0.2, 0.25), E("long_durability", 0, 0.3, 0.4)];
  }
  return [E("z2", 0.85, 0.6, 0.4), E("z2_progressive", 0.15, 0.25, 0.25), E("endurance_tempo", ...tempoW)];
}

export interface PickArgs {
  role: SlotRole;
  objective: string;
  level: VarietyLevel;
  vo2Stimulus?: string | null;
  weekIndex: number;
  dayOffset: number;
  /** Duración del slot (min), ya con el multiplicador de carga. */
  slotMin: number;
  isDeload: boolean;
  /** Todo lo ya hecho/planificado hasta ahora (historial previo + días anteriores de este plan). */
  history: HistoryEntry[];
  banned?: ReadonlySet<string>;
  /** Variantes a excluir (botón "Otra variante"). */
  exclude?: ReadonlySet<string>;
  /** Clave de la sesión del día anterior (si hubo). */
  prevDayKey?: string | null;
  /** Semana intensificada: se permite repetir la misma variante principal dentro de la semana. */
  allowRepeat?: boolean;
}

export interface PickResult {
  key: string;
  reason: string;
}

const weekOf = (dayOffset: number) => Math.floor(dayOffset / 7);

export function pickVariant(a: PickArgs): PickResult {
  const li = LEVEL_INDEX[a.level];
  const pool = poolFor(a.objective, a.role, a.vo2Stimulus, a.weekIndex);
  const poolKeys = new Set(pool.map((p) => p.key));
  const hist = a.history.filter((h) => h.dayOffset < a.dayOffset);
  const thisWeek = hist.filter((h) => weekOf(h.dayOffset) === weekOf(a.dayOffset));

  const lastOf = (key: string): number | null => {
    let best: number | null = null;
    for (const h of hist) if (h.key === key && (best == null || h.dayOffset > best)) best = h.dayOffset;
    return best;
  };

  const allowed = (e: PoolEntry, relaxGap: boolean): boolean => {
    const v = VARIANTS[e.key];
    if (!v) return false;
    if (e.w[li] <= 0) return false;
    if (a.banned?.has(e.key) || a.exclude?.has(e.key)) return false;
    if (a.slotMin < v.minSlotMin) return false;
    // Descarga: los rodajes y salidas largas son solo de baja intensidad
    if (a.isDeload && (a.role === "volume" || a.role === "long") && v.intensity > 0) return false;
    // Día después de una sesión dura (umbral/VO2max) o de sprints: solo rodaje fácil
    if ((a.role === "volume" || a.role === "long") && a.prevDayKey && (intensityOf(a.prevDayKey) >= 1 || isNeuroKey(a.prevDayKey)) && v.intensity > 0) return false;
    // Máximo semanal de la variante y de la familia neuromuscular
    if (!a.allowRepeat && thisWeek.filter((h) => h.key === e.key).length >= v.maxPerWeek) return false;
    if (v.neuro && thisWeek.some((h) => isNeuroKey(h.key))) return false;
    if (!relaxGap && !a.allowRepeat && v.minGapDays > 0) {
      const last = lastOf(e.key);
      if (last != null && a.dayOffset - last < v.minGapDays) return false;
    }
    return true;
  };

  let cands = pool.filter((e) => allowed(e, false));
  if (cands.length === 0) cands = pool.filter((e) => allowed(e, true));
  if (cands.length === 0) {
    const why = a.banned && pool.some((e) => a.banned!.has(e.key)) ? "variantes vetadas o sin lugar esta semana" : "sin variante disponible por las reglas de la semana";
    return { key: "z2", reason: `Rodaje Z2 (${why})` };
  }
  if (cands.length === 1) {
    const only = cands[0];
    return { key: only.key, reason: explain(only.key, lastOf(only.key), a.dayOffset, "única opción disponible") };
  }

  // Déficit de rotación: reparto objetivo (normalizado entre candidatas) menos lo realmente hecho en 4 semanas
  const recent = hist.filter((h) => h.dayOffset >= a.dayOffset - WINDOW_DAYS && cands.some((c) => c.key === h.key));
  const total = recent.length;
  const wSum = cands.reduce((s, c) => s + c.w[li], 0);
  let best = cands[0];
  let bestScore = -Infinity;
  for (const c of cands) {
    const target = c.w[li] / wSum;
    const actual = total ? recent.filter((h) => h.key === c.key).length / total : 0;
    const last = lastOf(c.key);
    const since = last == null ? WINDOW_DAYS : Math.min(WINDOW_DAYS, a.dayOffset - last);
    const score = target - actual + 0.02 * (since / WINDOW_DAYS);
    if (score > bestScore + 1e-9) {
      best = c;
      bestScore = score;
    }
  }
  return { key: best.key, reason: explain(best.key, lastOf(best.key), a.dayOffset, "rotación") };
}

function explain(key: string, last: number | null, dayOffset: number, cause: string): string {
  const label = VARIANTS[key]?.label ?? key;
  if (last == null) return `Variante: ${label} (${cause}; no figura en las últimas 4 semanas)`;
  const d = dayOffset - last;
  return `Variante: ${label} (${cause}; la última fue hace ${d} día${d === 1 ? "" : "s"})`;
}
