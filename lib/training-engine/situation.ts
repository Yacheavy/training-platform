import { buildBlocks } from "./block-builder";
import { calculateTss, type WorkoutBlock } from "./tss";
import { isOffBike } from "./off-bike";
import { QUALITY } from "./readiness-adjust";

/**
 * Situaciones de la vida real que reordenan la semana (módulo puro y determinista; la app solo aplica lo que el atleta confirma).
 *
 *  sick_neck  Síntomas solo "de cuello para arriba" (garganta, congestión) y sin fiebre.
 *  sick_body  Fiebre, tos de pecho, dolor muscular generalizado o malestar general.
 *  travel     Días de viaje (desde / hasta): no se entrena.
 *
 * Evidencia: la regla del cuello ("por encima / por debajo del cuello") es un criterio práctico de la medicina del deporte para
 * decidir si entrenar con una enfermedad respiratoria leve; NO es un umbral validado en ensayos, y no reemplaza la consulta médica.
 * Los topes de minutos de vuelta gradual son criterio de diseño de esta app.
 */
export type SituationKind = "sick_neck" | "sick_body" | "travel";
export const SITUATION_KINDS: SituationKind[] = ["sick_neck", "sick_body", "travel"];

export interface PlannedSession {
  id: string;
  dayKey: string; // YYYY-MM-DD
  key: string;
  blocks: WorkoutBlock[];
  status: string;
}

export type SituationActionKind = "rest" | "easy" | "keep";
export interface SituationAction {
  workoutId: string;
  dayKey: string;
  fromKey: string;
  fromMin: number;
  kind: SituationActionKind;
  newKey?: string;
  newBlocks?: WorkoutBlock[];
  toMin?: number;
  reason: string;
}

export interface SituationPlan {
  actions: SituationAction[];
  /** Solo las que cambian algo (rest o easy). */
  changes: SituationAction[];
  evidenceNote: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const minutesOf = (b: WorkoutBlock[]) => Math.round(b.reduce((s, x) => s + x.durationSec, 0) / 60);
const addDays = (key: string, n: number) => new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

const EVIDENCE: Record<SituationKind, string> = {
  sick_neck: "Regla del cuello (criterio práctico de la medicina del deporte, no un umbral validado en ensayos): con síntomas solo de cuello para arriba y sin fiebre se puede hacer algo muy suave; si empeoran o aparece fiebre, se descansa. No reemplaza una consulta médica.",
  sick_body: "Con fiebre, tos de pecho, dolor muscular generalizado o malestar general se descansa por completo (regla del cuello, criterio práctico de la medicina del deporte, no un umbral validado en ensayos) y se vuelve de a poco. No reemplaza una consulta médica.",
  travel: "Durante el viaje no se entrena. Las sesiones de calidad de esos días no se recuperan solas: al volver, regenerá el plan para reordenar la semana.",
};

function easyZ2(minutes: number, ftp: number): { key: string; blocks: WorkoutBlock[] } {
  return { key: "z2", blocks: buildBlocks("z2", minutes, ftp, null, null) };
}

export interface SituationOptions {
  /** Viaje: primer y último día (YYYY-MM-DD, inclusivos). */
  from?: string;
  to?: string;
}

export function planSituation(kind: SituationKind, todayKey: string, sessions: PlannedSession[], ftp: number, opts: SituationOptions = {}): SituationPlan {
  const actions: SituationAction[] = [];
  const keepAction = (s: PlannedSession, reason: string): SituationAction => ({ workoutId: s.id, dayKey: s.dayKey, fromKey: s.key, fromMin: minutesOf(s.blocks), kind: "keep", reason });
  const rest = (s: PlannedSession, reason: string): SituationAction => ({ ...keepAction(s, reason), kind: "rest" });
  const easy = (s: PlannedSession, minutes: number, reason: string): SituationAction => {
    const e = easyZ2(minutes, ftp);
    return { ...keepAction(s, reason), kind: "easy", newKey: e.key, newBlocks: e.blocks, toMin: minutesOf(e.blocks) };
  };

  const pending = sessions.filter((s) => s.status !== "COMPLETED" && s.dayKey >= todayKey).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const from = opts.from ?? todayKey;
  const to = opts.to ?? from;

  for (const s of pending) {
    const m = minutesOf(s.blocks);
    const quality = QUALITY.has(s.key);
    const off = isOffBike(s.key);

    if (kind === "travel") {
      if (s.dayKey >= from && s.dayKey <= to) actions.push(rest(s, "Día de viaje: sin entrenar"));
      continue;
    }

    if (kind === "sick_body") {
      if (s.dayKey <= addDays(todayKey, 2)) actions.push(rest(s, "Descanso completo mientras haya síntomas generales"));
      else if (s.dayKey <= addDays(todayKey, 4) && !off && (quality || m > 60)) actions.push(easy(s, Math.min(m, 60), "Vuelta gradual: sin intensidad y más corto"));
      continue;
    }

    // sick_neck
    if (s.dayKey === todayKey) {
      if (off) actions.push(rest(s, "Hoy sin fuerza con síntomas"));
      else actions.push(easy(s, Math.min(m, 40), "Solo algo muy suave de Z2, y cortá si te sentís peor"));
    } else if (s.dayKey === addDays(todayKey, 1) && !off && quality) {
      actions.push(easy(s, Math.min(m, 60), "Mañana sin intensidad por si los síntomas siguen"));
    }
  }

  // Una sesión de bici "easy" que no cambia nada (ya era un Z2 corto) pasa a "keep"
  const final = actions.map((a) => (a.kind === "easy" && a.fromKey === "z2" && a.toMin != null && a.toMin >= a.fromMin ? { ...a, kind: "keep" as const, newKey: undefined, newBlocks: undefined, toMin: undefined, reason: "Ya es un rodaje suave: se mantiene" } : a));
  return { actions: final, changes: final.filter((a) => a.kind !== "keep"), evidenceNote: EVIDENCE[kind] };
}

export function tssOf(blocks: WorkoutBlock[], ftp: number): number {
  return calculateTss(blocks, ftp);
}
