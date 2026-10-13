import { prisma } from "@/lib/prisma";
import { upsertGoalEvents, deleteEventByExternalId, type IntervalsGoalEvent } from "@/lib/intervals-client";
import { getIntervalsCreds, type IntervalsCreds } from "@/lib/intervals-creds";
import { dateKeyLocal } from "@/lib/tz";

const PROFILE_LABEL: Record<string, string> = { llano: "llano", ondulado: "ondulado", montana: "montaña", fondo: "fondo", contrarreloj: "contrarreloj", criterium: "criterium" };

export const goalExternalId = (goalId: string) => `goal-${goalId}`;

interface GoalRow {
  id: string;
  goalType: "EVENT" | "PERFORMANCE";
  name: string;
  priority: "A" | "B" | "C";
  eventDate: Date | null;
  courseProfile: string | null;
  metric: string | null;
  baselineValue: number | null;
  targetValue: number | null;
}

/** Evento de Intervals de un objetivo: carrera A/B/C, o una nota para las metas de rendimiento. Sin fecha no se puede enviar (null). */
export function goalToIntervalsEvent(g: GoalRow): IntervalsGoalEvent | null {
  if (!g.eventDate) return null;
  const day = g.eventDate.toISOString().slice(0, 10);
  if (g.goalType === "EVENT") {
    const profile = g.courseProfile ? PROFILE_LABEL[g.courseProfile] : null;
    return {
      external_id: goalExternalId(g.id),
      category: `RACE_${g.priority}`,
      day,
      name: g.name,
      description: `Carrera de prioridad ${g.priority}${profile ? ` · perfil ${profile}` : ""}. Cargada en Overkill Cycling.`,
    };
  }
  const detail = [g.metric ? `Métrica: ${g.metric}` : null, g.baselineValue != null ? `Punto de partida: ${g.baselineValue}` : null, g.targetValue != null ? `Meta: ${g.targetValue}` : null].filter(Boolean).join(" · ");
  return {
    external_id: goalExternalId(g.id),
    category: "NOTE",
    day,
    name: `Objetivo: ${g.name}`,
    description: `Objetivo de rendimiento (prioridad ${g.priority})${detail ? `. ${detail}` : ""}. Cargado en Overkill Cycling.`,
  };
}

/**
 * Envía a Intervals los objetivos con fecha de hoy en adelante que todavía no se enviaron. Es idempotente (upsert por external_id)
 * y nunca debe romper lo que lo llama: si falla, queda pendiente y se reintenta en la próxima sincronización.
 */
export async function pushGoalsToIntervals(athleteId: string, knownCreds?: IntervalsCreds | null): Promise<number> {
  const creds = knownCreds ?? (await getIntervalsCreds(athleteId));
  if (!creds) return 0;
  const today = new Date(`${dateKeyLocal(new Date())}T00:00:00Z`);
  const goals = await prisma.athleteGoal.findMany({
    where: { athleteId, intervalsSentAt: null, eventDate: { gte: today } },
    select: { id: true, goalType: true, name: true, priority: true, eventDate: true, courseProfile: true, metric: true, baselineValue: true, targetValue: true },
  });
  const pairs = goals.map((g) => ({ g, ev: goalToIntervalsEvent(g) })).filter((p): p is { g: typeof p.g; ev: IntervalsGoalEvent } => p.ev != null);
  if (pairs.length === 0) return 0;
  await upsertGoalEvents(creds.athleteId, creds.apiKey, pairs.map((p) => p.ev));
  await prisma.athleteGoal.updateMany({ where: { id: { in: pairs.map((p) => p.g.id) } }, data: { intervalsSentAt: new Date() } });
  return pairs.length;
}

/** Quita de Intervals el evento de un objetivo que se borró (solo si se había enviado). */
export async function removeGoalFromIntervals(athleteId: string, goal: { id: string; eventDate: Date | null; intervalsSentAt: Date | null }): Promise<void> {
  if (!goal.intervalsSentAt || !goal.eventDate) return;
  const creds = await getIntervalsCreds(athleteId);
  if (!creds) return;
  await deleteEventByExternalId(creds.athleteId, creds.apiKey, goalExternalId(goal.id), goal.eventDate.toISOString().slice(0, 10));
}
