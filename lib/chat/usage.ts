import { prisma } from "@/lib/prisma";
import { dateKeyLocal, dayStartLocal } from "@/lib/tz";
import { DAILY_LIMIT } from "./limits";

export interface ChatUsageSummary {
  isCoach: boolean;
  limit: number;
  sentToday: number;
  remaining: number | null;
  todayTokens: number;
  todayCostUsd: number;
  monthMessages: number;
  monthCostUsd: number;
  avgCostPerMessageUsd: number | null;
}

/** Uso del chat de un atleta: mensajes de hoy, tokens y costo estimado (solo cuenta respuestas con uso registrado). */
export async function getChatUsage(athleteId: string): Promise<ChatUsageSummary> {
  const now = new Date();
  const dayStart = dayStartLocal(now);
  const monthStart = dayStartLocal(new Date(`${dateKeyLocal(now).slice(0, 8)}01T12:00:00-03:00`));
  const [user, sentToday, todayAgg, monthAgg] = await Promise.all([
    prisma.user.findUnique({ where: { id: athleteId }, select: { role: true } }),
    prisma.chatMessage.count({ where: { athleteId, role: "user", createdAt: { gte: dayStart } } }),
    prisma.chatMessage.aggregate({ where: { athleteId, role: "assistant", costUsd: { not: null }, createdAt: { gte: dayStart } }, _sum: { inputTokens: true, outputTokens: true, costUsd: true } }),
    prisma.chatMessage.aggregate({ where: { athleteId, role: "assistant", costUsd: { not: null }, createdAt: { gte: monthStart } }, _sum: { costUsd: true }, _count: { _all: true } }),
  ]);
  const isCoach = user?.role === "COACH";
  const monthCost = monthAgg._sum.costUsd ?? 0;
  const monthMessages = monthAgg._count._all;
  return {
    isCoach,
    limit: DAILY_LIMIT,
    sentToday,
    remaining: isCoach ? null : Math.max(0, DAILY_LIMIT - sentToday),
    todayTokens: (todayAgg._sum.inputTokens ?? 0) + (todayAgg._sum.outputTokens ?? 0),
    todayCostUsd: todayAgg._sum.costUsd ?? 0,
    monthMessages,
    monthCostUsd: monthCost,
    avgCostPerMessageUsd: monthMessages > 0 ? monthCost / monthMessages : null,
  };
}
