import { prisma } from "@/lib/prisma";
import { dateKeyLocal } from "@/lib/tz";
import { planSituation, SITUATION_KINDS, type SituationKind, type SituationPlan } from "@/lib/training-engine/situation";
import type { WorkoutBlock } from "@/lib/training-engine/tss";

const DAY_MS = 24 * 60 * 60 * 1000;
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseKind(v: unknown): SituationKind | null {
  return SITUATION_KINDS.includes(v as SituationKind) ? (v as SituationKind) : null;
}

/** Fechas de viaje válidas: formato correcto, desde ≤ hasta, hoy o después, máximo 30 días. */
export function parseTripDates(from: unknown, to: unknown, todayKey: string): { from: string; to: string } | { error: string } {
  const f = String(from ?? ""), t = String(to ?? "");
  if (!KEY_RE.test(f) || !KEY_RE.test(t)) return { error: "Elegí la fecha de salida y la de vuelta" };
  if (t < f) return { error: "La vuelta no puede ser antes de la salida" };
  if (t < todayKey) return { error: "El viaje ya terminó" };
  if ((Date.parse(t) - Date.parse(f)) / DAY_MS > 30) return { error: "El viaje no puede durar más de 30 días" };
  return { from: f, to: t };
}

/** Calcula en el servidor lo que cambiaría la situación sobre las sesiones pendientes del atleta (hoy y los próximos 35 días). */
export async function loadSituationPlan(athleteId: string, kind: SituationKind, trip?: { from: string; to: string }): Promise<{ plan: SituationPlan; ftp: number } | { error: string }> {
  const user = await prisma.user.findUnique({ where: { id: athleteId }, select: { ftp: true } });
  if (!user?.ftp) return { error: "Cargá el FTP en Ajustes primero" };
  const todayKey = dateKeyLocal(new Date());
  const start = new Date(Date.parse(`${todayKey}T00:00:00Z`) - DAY_MS);
  const rows = await prisma.generatedWorkout.findMany({
    where: { athleteId, date: { gte: start, lt: new Date(start.getTime() + 37 * DAY_MS) }, status: { not: "COMPLETED" } },
    orderBy: { date: "asc" },
  });
  const sessions = rows.map((w) => ({ id: w.id, dayKey: dateKeyLocal(new Date(w.date)), key: w.workoutLibraryKey, blocks: w.blocksJson as unknown as WorkoutBlock[], status: w.status }));
  return { plan: planSituation(kind, todayKey, sessions, user.ftp, trip), ftp: user.ftp };
}
