import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { buildLoadTrend } from "@/lib/training-engine/load-ratio";
import { classifyStimulusType } from "@/lib/training-engine/stimulus-classifier";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const activities = await prisma.activity.findMany({
    where: {
      athleteId: session.user.id,
      type: "Ride",
      date: { gte: ninetyDaysAgo },
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      name: true,
      type: true,
      intensityFactor: true,
      durationSec: true,
      tss: true,
      trimp: true,
      efficiencyFactor: true,
      decouplingPct: true,
      rawStreamsJson: true,
    },
  });

  // Agrupamos por tipo de estímulo ANTES de armar la tendencia,
  // así cada serie compara sesiones del mismo tipo entre sí
  const byStimulus: Record<string, typeof activities> = {};
  for (const a of activities) {
    const st = classifyStimulusType(a);
    if (!byStimulus[st]) byStimulus[st] = [];
    byStimulus[st].push(a);
  }

  const trendsByStimulus: Record<string, ReturnType<typeof buildLoadTrend>> = {};
  for (const [stimulusType, acts] of Object.entries(byStimulus)) {
    trendsByStimulus[stimulusType] = buildLoadTrend(acts);
  }

  return NextResponse.json(trendsByStimulus);
}