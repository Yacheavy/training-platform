import { prisma } from "@/lib/prisma";
import { getLoadHistory } from "@/lib/dashboard-data";
import { detectPlateau, PLATEAU_WEEKS, type PlateauResult } from "@/lib/training-engine/plateau";
import { dayKeyDate } from "@/lib/tz";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Estancamiento de carga del atleta (ver training-engine/plateau.ts). null si no hay datos para evaluarlo. */
export async function getPlateau(athleteId: string): Promise<PlateauResult | null> {
  const today = dayKeyDate(new Date());
  const [load, user, thresholds, goals, acts] = await Promise.all([
    getLoadHistory(athleteId, PLATEAU_WEEKS * 7 + 7),
    prisma.user.findUnique({ where: { id: athleteId }, select: { ftpUpdatedAt: true } }),
    prisma.athleteThresholds.findUnique({ where: { athleteId }, select: { maxCtlRampPerWeek: true } }),
    prisma.athleteGoal.findMany({ where: { athleteId, priority: { in: ["A", "B"] }, eventDate: { gte: new Date(today.getTime() - 3 * DAY_MS) } }, orderBy: { eventDate: "asc" }, take: 1, select: { eventDate: true } }),
    prisma.activity.aggregate({ where: { athleteId, date: { gte: new Date(today.getTime() - PLATEAU_WEEKS * 7 * DAY_MS), lt: new Date(today.getTime() + DAY_MS) } }, _sum: { tss: true } }),
  ]);
  if (load.length === 0) return null;
  const next = goals[0]?.eventDate ?? null;
  return detectPlateau({
    days: load.map((r) => ({ date: new Date(r.date), ctl: r.ctl })),
    today,
    avgWeeklyTss: acts._sum.tss != null ? acts._sum.tss / PLATEAU_WEEKS : null,
    daysToNextGoal: next ? Math.round((next.getTime() - today.getTime()) / DAY_MS) : null,
    ftpStaleWeeks: user?.ftpUpdatedAt ? Math.floor((today.getTime() - user.ftpUpdatedAt.getTime()) / (7 * DAY_MS)) : null,
    maxCtlRampPerWeek: thresholds?.maxCtlRampPerWeek ?? 5,
  });
}
