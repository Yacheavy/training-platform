import { prisma } from "@/lib/prisma";
import { dateKeyLocal, dayStartLocal } from "@/lib/tz";
import { proposeSeason, pickPrimaryGoal, type SeasonProposal } from "@/lib/training-engine/season-planner";

const DAY = 86400000;
const keyMs = (k: string) => new Date(k + "T00:00:00Z").getTime();

export interface SeasonState {
  todayKey: string;
  goal: { id: string; name: string; type: "EVENT" | "PERFORMANCE"; dateKey: string; metric: string | null; priority: string } | null;
  existing: { id: string; name: string; objective: string; startKey: string; endKey: string; isFuture: boolean }[];
  proposal: SeasonProposal;
  periodization: string;
  /** Instante base para convertir claves a fechas guardadas (fin del último bloque, o inicio del día local de hoy). */
  baseInstantMs: number;
}

/** Estado de la temporada: objetivo principal, bloques existentes y propuesta (solo servidor). */
export async function getSeasonState(athleteId: string, now = new Date()): Promise<SeasonState> {
  const [goals, blocks, thresholds] = await Promise.all([
    prisma.athleteGoal.findMany({ where: { athleteId, eventDate: { not: null } } }),
    prisma.trainingBlock.findMany({ where: { athleteId, endDate: { gte: dayStartLocal(now) } }, orderBy: { startDate: "asc" } }),
    prisma.athleteThresholds.findUnique({ where: { athleteId }, select: { periodization: true } }),
  ]);
  const todayKey = dateKeyLocal(now);
  const goalRows = goals.map((g) => ({ ...g, dateKey: g.eventDate ? dateKeyLocal(g.eventDate) : null }));
  // eventDate se guarda como medianoche UTC del día elegido: se usa la fecha UTC (no la local) para no correrla un día
  for (const g of goalRows) if (g.eventDate) g.dateKey = g.eventDate.toISOString().slice(0, 10);
  const primary = pickPrimaryGoal(goalRows, todayKey);
  const existing = blocks.map((b) => ({
    id: b.id,
    name: b.name,
    objective: b.objective,
    startKey: dateKeyLocal(b.startDate),
    endKey: dateKeyLocal(b.endDate),
    isFuture: b.startDate.getTime() > dayStartLocal(now).getTime() + DAY - 1,
  }));
  const goal = primary
    ? { id: primary.id, name: primary.name, type: primary.goalType as "EVENT" | "PERFORMANCE", dateKey: primary.dateKey!, metric: primary.metric, priority: primary.priority }
    : null;
  const proposal = proposeSeason({ todayKey, goal, existing: existing.map((e) => ({ objective: e.objective, startKey: e.startKey, endKey: e.endKey })) });
  const lastEnd = blocks.length ? blocks[blocks.length - 1].endDate : null;
  const baseInstantMs = lastEnd && dateKeyLocal(lastEnd) > todayKey ? lastEnd.getTime() : dayStartLocal(now).getTime();
  return { todayKey, goal, existing, proposal, periodization: thresholds?.periodization ?? "linear", baseInstantMs };
}

/** Convierte una clave YYYY-MM-DD al instante guardado, manteniendo múltiplos exactos de días desde la base. */
export function instantForKey(state: Pick<SeasonState, "baseInstantMs">, key: string): Date {
  const baseKey = dateKeyLocal(new Date(state.baseInstantMs));
  return new Date(state.baseInstantMs + Math.round((keyMs(key) - keyMs(baseKey)) / DAY) * DAY);
}
