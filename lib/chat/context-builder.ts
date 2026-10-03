import { prisma } from "@/lib/prisma";
import { calculateAvailability } from "@/lib/training-engine/availability";

export async function buildChatContext(athleteId: string, focusedWorkoutId?: string): Promise<string> {
  const parts: string[] = [];

  const user = await prisma.user.findUnique({ where: { id: athleteId } });
  parts.push(`ATLETA: FTP ${user?.ftp ?? "no configurado"}W, peso ${user?.weight ?? "no configurado"}kg`);

  if (user?.trainingBackground) {
    parts.push(`TRAYECTORIA DEL ATLETA (escrita por él mismo): ${user.trainingBackground}`);
  }
  if (user?.currentStateNote) {
    const daysAgo = user.currentStateUpdatedAt
      ? Math.floor((Date.now() - user.currentStateUpdatedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    parts.push(
      `ESTADO ACTUAL DEL ATLETA (escrito por él mismo${daysAgo != null ? `, actualizado hace ${daysAgo} días` : ""}): ${user.currentStateNote}`
    );
  }
  if (user?.preferences) {
    parts.push(`PREFERENCIAS Y LÍMITES DEL ATLETA: ${user.preferences}`);
  }

  const availability = await calculateAvailability(athleteId);
  parts.push(
    `DISPONIBILIDAD HOY: ${availability.status} — HRV hoy ${availability.hrvToday ?? "sin dato"}, media 7d ${availability.hrvAvg7d?.toFixed(1) ?? "sin dato"}, TSB ${availability.tsb?.toFixed(1) ?? "sin dato"}. Razones: ${availability.reasons.join("; ")}`
  );

  const latestWellness = await prisma.wellness.findFirst({
    where: { athleteId, ctl: { not: null } },
    orderBy: { date: "desc" },
  });
  if (latestWellness?.ctl != null && latestWellness?.atl != null) {
    parts.push(
      `CARGA ACTUAL: CTL (fitness) ${latestWellness.ctl.toFixed(1)}, ATL (fatiga) ${latestWellness.atl.toFixed(1)}, ramp rate ${latestWellness.rampRate?.toFixed(2) ?? "sin dato"} — dato del ${latestWellness.date.toISOString().split("T")[0]}`
    );
  }

  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);

  const ctl4wAgo = await prisma.wellness.findFirst({
    where: { athleteId, ctl: { not: null }, date: { lte: fourWeeksAgo } },
    orderBy: { date: "desc" },
  });
  const ctl8wAgo = await prisma.wellness.findFirst({
    where: { athleteId, ctl: { not: null }, date: { lte: eightWeeksAgo } },
    orderBy: { date: "desc" },
  });

  if (latestWellness?.ctl != null) {
    const trendParts: string[] = [`hoy: ${latestWellness.ctl.toFixed(1)}`];
    if (ctl4wAgo?.ctl != null) {
      const deltaPerWeek = (latestWellness.ctl - ctl4wAgo.ctl) / 4;
      trendParts.push(`hace 4 semanas: ${ctl4wAgo.ctl.toFixed(1)} (${deltaPerWeek >= 0 ? "+" : ""}${deltaPerWeek.toFixed(1)}/sem promedio)`);
    }
    if (ctl8wAgo?.ctl != null) {
      trendParts.push(`hace 8 semanas: ${ctl8wAgo.ctl.toFixed(1)}`);
    }
    parts.push(`TENDENCIA DE CTL: ${trendParts.join(" | ")}`);
  }

  const tsbTrendParts: string[] = [];
  if (availability.tsb != null) tsbTrendParts.push(`hoy: ${availability.tsb.toFixed(1)}`);
  if (ctl4wAgo?.ctl != null && ctl4wAgo?.atl != null) {
    tsbTrendParts.push(`hace 4 semanas: ${(ctl4wAgo.ctl - ctl4wAgo.atl).toFixed(1)}`);
  }
  if (ctl8wAgo?.ctl != null && ctl8wAgo?.atl != null) {
    tsbTrendParts.push(`hace 8 semanas: ${(ctl8wAgo.ctl - ctl8wAgo.atl).toFixed(1)}`);
  }
  if (tsbTrendParts.length > 0) {
    parts.push(`TENDENCIA DE TSB (forma): ${tsbTrendParts.join(" | ")}`);
  }

  const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const hrv28dRecords = await prisma.wellness.findMany({
    where: { athleteId, date: { gte: twentyEightDaysAgo }, hrv: { not: null } },
    select: { hrv: true },
  });
  const hrv28dValues = hrv28dRecords.map((w) => w.hrv!).filter(Boolean);
  if (hrv28dValues.length > 0) {
    const hrvAvg28d = hrv28dValues.reduce((a, b) => a + b, 0) / hrv28dValues.length;
    parts.push(
      `TENDENCIA DE HRV (28 días): media ${hrvAvg28d.toFixed(1)} — comparar contra la media de 7 días reciente de arriba para detectar si hay una caída sostenida de varias semanas (señal de fatiga crónica) vs. una variación normal de corto plazo`
    );
  }

  const activeBlock = await prisma.trainingBlock.findFirst({
    where: { athleteId, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
  });
  parts.push(
    activeBlock
      ? `BLOQUE ACTIVO: "${activeBlock.name}", objetivo: ${activeBlock.objective}, hasta ${activeBlock.endDate.toISOString().split("T")[0]}`
      : `BLOQUE ACTIVO: ninguno configurado`
  );

  const performanceGoals = await prisma.athleteGoal.findMany({
    where: { athleteId, goalType: "PERFORMANCE" },
  });
  if (performanceGoals.length > 0) {
    const lines = performanceGoals.map(
      (g) => `- ${g.name}: ${g.metric} ${g.baselineValue ?? "?"} → ${g.targetValue ?? "?"}${g.eventDate ? ` (objetivo para ${g.eventDate.toISOString().split("T")[0]})` : ""}`
    );
    parts.push(`OBJETIVOS DE RENDIMIENTO ACTIVOS:\n${lines.join("\n")}`);
  }

  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const recentActivities = await prisma.activity.findMany({
    where: { athleteId, date: { gte: tenDaysAgo } },
    orderBy: { date: "desc" },
    select: { date: true, name: true, type: true, tss: true, durationSec: true, deviationFlag: true, deviationNotes: true, decouplingPct: true },
  });
  if (recentActivities.length > 0) {
    const lines = recentActivities.map((a) => {
      const dev = a.deviationFlag !== "NONE" ? ` ⚠ ${a.deviationFlag}: ${a.deviationNotes}` : "";
      return `- ${a.date.toISOString().split("T")[0]} ${a.name ?? a.type} (${Math.round(a.durationSec / 60)}min, TSS ${a.tss?.toFixed(0) ?? "?"}${dev})`;
    });
    parts.push(`ÚLTIMOS 10 DÍAS DE ENTRENAMIENTO:\n${lines.join("\n")}`);
  } else {
    parts.push(`ÚLTIMOS 10 DÍAS: sin actividades registradas`);
  }

  const responseProfiles = await prisma.athleteResponseProfile.findMany({ where: { athleteId } });
  if (responseProfiles.length > 0) {
    const lines = responseProfiles.map(
      (p) => `- ${p.stimulusType}: impacto HRV promedio ${p.avgHrvImpactNextDayPct?.toFixed(1)}% al día siguiente (n=${p.sessionsCount})`
    );
    parts.push(`PERFIL DE RESPUESTA INDIVIDUAL (aprendido de tu historial):\n${lines.join("\n")}`);
  }

  if (focusedWorkoutId) {
    const workout = await prisma.generatedWorkout.findUnique({ where: { id: focusedWorkoutId } });
    if (workout) {
      parts.push(
        `WORKOUT ENFOCADO (el atleta está viendo esta sesión ahora): ${workout.workoutLibraryKey}, TSS estimado ${workout.estimatedTss}, estado ${workout.status}, bloques: ${JSON.stringify(workout.blocksJson)}`
      );
    }
  }

  return parts.join("\n\n");
}