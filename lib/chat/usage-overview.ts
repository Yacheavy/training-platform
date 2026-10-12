import { prisma } from "@/lib/prisma";
import { summarizeUsage, type UsageOverview } from "./usage-summary";

export interface CoachUsageOverview extends UsageOverview {
  names: Record<string, string>;
}

/** Consumo de IA de toda la app (el entrenador y sus alumnos): tokens y dinero estimado, hoy / 7 días / mes / total. */
export async function getCoachUsageOverview(): Promise<CoachUsageOverview> {
  const now = new Date();
  const rows = await prisma.chatMessage.findMany({
    where: { role: "assistant" },
    select: { athleteId: true, role: true, createdAt: true, inputTokens: true, outputTokens: true, costUsd: true },
  });
  // Los análisis enviados por mail gastan IA igual: entran como una respuesta más de cada persona
  const mail = await prisma.aiUsageEvent.findMany({ select: { athleteId: true, createdAt: true, inputTokens: true, outputTokens: true, costUsd: true } });
  const overview = summarizeUsage([...rows, ...mail.map((m) => ({ ...m, role: "assistant" }))], now);
  const users = await prisma.user.findMany({ where: { id: { in: overview.perStudent.map((s) => s.athleteId) } }, select: { id: true, name: true, email: true } });
  const names = Object.fromEntries(users.map((u) => [u.id, u.name ?? u.email ?? "Sin nombre"]));
  return { ...overview, names };
}
