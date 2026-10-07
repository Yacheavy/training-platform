import { prisma } from "@/lib/prisma";
import { progressionAdjustments, intensityGuard, type ExecutionRecord, type ProgressionAdjust, type IntensityGuard, type ZoneHours } from "@/lib/training-engine/autoregulation";

const DAY = 86400000;
const RIDE = ["Ride", "VirtualRide", "GravelRide", "MountainBikeRide", "EBikeRide"];

export interface AutoregulationState {
  records: ExecutionRecord[];
  execution: Record<string, ProgressionAdjust>;
  zones: ZoneHours;
  guard: IntensityGuard | null;
}

/** Ejecución real de las últimas 8 semanas (sesiones vinculadas a un plan) y distribución de intensidad de 14 días. */
export async function loadAutoregulation(athleteId: string, now = new Date()): Promise<AutoregulationState> {
  const executed = await prisma.activity.findMany({
    where: { athleteId, generatedWorkoutId: { not: null }, date: { gte: new Date(now.getTime() - 56 * DAY), lte: now } },
    select: { date: true, tss: true, plannedTss: true, deviationFlag: true, decouplingPct: true, generatedWorkout: { select: { workoutLibraryKey: true } } },
  });
  const records: ExecutionRecord[] = executed
    .filter((a) => a.generatedWorkout && a.generatedWorkout.workoutLibraryKey !== "gym" && !a.generatedWorkout.workoutLibraryKey.startsWith("ftp_test"))
    .map((a) => ({
      key: a.generatedWorkout!.workoutLibraryKey,
      at: a.date.getTime(),
      tssRatio: a.tss != null && a.plannedTss ? a.tss / a.plannedTss : null,
      deviation: a.deviationFlag,
      decouplingPct: a.decouplingPct,
    }));

  const rides = await prisma.activity.findMany({
    where: { athleteId, type: { in: RIDE }, date: { gte: new Date(now.getTime() - 14 * DAY), lte: now } },
    select: { rawStreamsJson: true },
  });
  const zones: ZoneHours = { lowH: 0, midH: 0, highH: 0 };
  for (const r of rides) {
    const zt = (r.rawStreamsJson as { zoneTimes?: { id: string; secs: number }[] } | null)?.zoneTimes;
    for (const z of zt ?? []) {
      if (z.id === "Z1" || z.id === "Z2") zones.lowH += z.secs / 3600;
      else if (z.id === "Z3" || z.id === "Z4") zones.midH += z.secs / 3600;
      else if (["Z5", "Z6", "Z7"].includes(z.id)) zones.highH += z.secs / 3600;
    }
  }
  return { records, execution: progressionAdjustments(records), zones, guard: intensityGuard(zones) };
}
