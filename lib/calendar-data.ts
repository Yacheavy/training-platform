import { prisma } from "@/lib/prisma";

export interface CalendarEvent {
  /** "YYYY-MM-DD" */
  date: string;
  name: string;
  kind: "EVENT" | "PERFORMANCE";
  priority: "A" | "B" | "C";
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Sesiones planificadas y objetivos (carreras y metas) de una persona para el mes pedido, con una semana de margen a cada lado
 * (la vista por semana puede cruzar el límite del mes).
 */
export async function getCalendarData(athleteId: string, year: number, month: number) {
  const from = new Date(Date.UTC(year, month, 1) - 7 * DAY);
  const to = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59) + 7 * DAY);
  const [workouts, goals] = await Promise.all([
    prisma.generatedWorkout.findMany({
      where: { athleteId, date: { gte: from, lte: to } },
      select: { id: true, date: true, workoutLibraryKey: true, status: true, estimatedTss: true, estimatedKj: true, suggestedCarbsG: true, rationale: true, blocksJson: true },
    }),
    prisma.athleteGoal.findMany({
      where: { athleteId, eventDate: { gte: from, lte: to } },
      select: { eventDate: true, name: true, goalType: true, priority: true },
    }),
  ]);
  const events: CalendarEvent[] = goals
    .filter((g) => g.eventDate)
    .map((g) => ({ date: g.eventDate!.toISOString().slice(0, 10), name: g.name.trim(), kind: g.goalType, priority: g.priority }));
  return {
    workouts: workouts.map((w) => ({
      ...w,
      date: w.date.toISOString(),
      blocksJson: w.blocksJson as unknown as { type: string; durationSec: number; targetWatts: number }[],
    })),
    events,
  };
}
