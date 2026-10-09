import { ensureActivityLaps, describeLaps } from "@/lib/laps";
import { ensureActivityWeather, describeWeather } from "@/lib/weather";
import { describeRatings, readRatings, validRpe, ifRatio } from "@/lib/ratings";
import { getNutritionSummary, toNutritionInput, NUTRITION_SELECT } from "@/lib/nutrition-data";
import { describeSessionNutrition, toSessionNutrition } from "@/lib/training-engine/nutrition-analysis";
import { prisma } from "@/lib/prisma";
import { dayKeyDate, dateKeyLocal, ATHLETE_TZ } from "@/lib/tz";
import { STIMULUS_LABELS } from "@/lib/labels";
import { calculateAvailability } from "@/lib/training-engine/availability";
import { classifyStimulusType } from "@/lib/training-engine/stimulus-classifier";

type Blk = { type: string; durationSec: number; targetWatts: number };
const fmtDur = (s: number) => (s % 60 === 0 ? `${s / 60}min` : s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`);

/** Resumen legible de los bloques: agrupa los pares intervalo/recuperación repetidos. */
function summarizeBlocks(blocks: Blk[]): string {
  const out: string[] = [];
  for (let i = 0; i < blocks.length; ) {
    const b = blocks[i];
    const r = blocks[i + 1];
    if (b.type === "interval" && r && r.type === "recovery") {
      let n = 1;
      let j = i + 2;
      while (blocks[j]?.type === "interval" && blocks[j].durationSec === b.durationSec && blocks[j].targetWatts === b.targetWatts && blocks[j + 1]?.type === "recovery") {
        n++;
        j += 2;
      }
      out.push(`${n}× (${fmtDur(b.durationSec)} a ${b.targetWatts}W / recuperación ${fmtDur(r.durationSec)} a ${r.targetWatts}W)`);
      i = j;
      continue;
    }
    out.push(`${b.type} ${fmtDur(b.durationSec)} a ${b.targetWatts}W`);
    i++;
  }
  return out.join(" → ");
}

function relativeDay(dayKey: string): string {
  const diff = Math.round((Date.parse(dayKey) - Date.parse(dateKeyLocal(new Date()))) / 86400000);
  if (diff === 0) return "HOY";
  if (diff === 1) return "MAÑANA";
  if (diff === -1) return "AYER";
  return diff > 0 ? `en ${diff} días` : `hace ${-diff} días`;
}

const RIDE_TYPES_SET = new Set(["Ride", "VirtualRide", "GravelRide", "MountainBikeRide", "EBikeRide"]);

export async function buildChatContext(athleteId: string, focusedWorkoutId?: string, focusedActivityId?: string): Promise<string> {
  const parts: string[] = [];
  // La sesión en foco va PRIMERO: es de lo que habla el atleta cuando dice "esta sesión"
  const focusParts: string[] = [];

  const user = await prisma.user.findUnique({ where: { id: athleteId } });
  const todayKey = dateKeyLocal(new Date());
  parts.push(`FECHA DE HOY: ${new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ATHLETE_TZ })} (${todayKey}, hora de Argentina).`);
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
    where: { athleteId, ctl: { not: null }, date: { lte: dayKeyDate(new Date()) } },
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

  const nextBlocks = await prisma.trainingBlock.findMany({
    where: { athleteId, startDate: { gt: new Date() } },
    orderBy: { startDate: "asc" },
    take: 4,
  });
  if (nextBlocks.length > 0) {
    parts.push(
      `PRÓXIMOS BLOQUES DE LA TEMPORADA:\n${nextBlocks.map((b) => `- ${b.name}: ${b.objective}, ${b.startDate.toISOString().split("T")[0]} → ${b.endDate.toISOString().split("T")[0]}`).join("\n")}`
    );
  }
  const periodRow = await prisma.athleteThresholds.findUnique({ where: { athleteId }, select: { periodization: true, varietyLevel: true, bannedStimuli: true } });
  if (periodRow) {
    parts.push(
      `PLANIFICACIÓN: periodización ${periodRow.periodization === "block" ? "por bloques (semana intensificada de VO2max)" : "lineal"}, variedad ${periodRow.varietyLevel}${periodRow.bannedStimuli.length ? `, variantes vetadas: ${periodRow.bannedStimuli.join(", ")}` : ""}`
    );
  }

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

  // Nutrición intra-entrenamiento (CHO/líquido registrados) vs. rendimiento, últimas 6 semanas
  try {
    const nut = await getNutritionSummary(athleteId, 42);
    if (nut.eligible > 0) {
      const nl2 = [
        `NUTRICIÓN DURANTE LAS SESIONES (últimas 6 semanas; solo sesiones de 1 h o más): registró ${nut.logged} de ${nut.eligible}${nut.coveragePct != null ? ` (${nut.coveragePct}%)` : ""}.`,
        ...nut.insights.map((i) => `- ${i}`),
        `Usá SOLO estos datos para hablar de alimentación. Lo no registrado es "sin dato", nunca cero. Las diferencias son asociaciones, no causas: no afirmes que la mala alimentación "causó" un mal rendimiento, decí que puede haber influido. Los objetivos de CHO salen de Jeukendrup 2014 y ACSM 2016; no inventes otras cifras.`,
      ];
      parts.push(nl2.join("\n"));
    }
  } catch {
    // el análisis de nutrición es complementario: si falla, el chat sigue sin él
  }

  // Próximas sesiones planificadas (para responder "qué hago mañana", "cómo viene la semana")
  const todayStart = dayKeyDate(new Date());
  const upcoming = await prisma.generatedWorkout.findMany({
    where: { athleteId, date: { gte: new Date(todayStart.getTime() - 24 * 3600 * 1000), lt: new Date(todayStart.getTime() + 8 * 24 * 3600 * 1000) } },
    orderBy: { date: "asc" },
  });
  const upcomingLines = upcoming
    .filter((w) => dateKeyLocal(w.date) >= todayKey)
    .map((w) => {
      const k = dateKeyLocal(w.date);
      const mins = Math.round((w.blocksJson as unknown as Blk[]).reduce((x, b) => x + (b.durationSec ?? 0), 0) / 60);
      return `- ${k} (${relativeDay(k)}): ${STIMULUS_LABELS[w.workoutLibraryKey] ?? w.workoutLibraryKey}, ${mins}min, TSS ${w.estimatedTss ?? "?"}, estado ${w.status}`;
    });
  if (upcomingLines.length) parts.push(`PRÓXIMAS SESIONES PLANIFICADAS (7 días):\n${upcomingLines.join("\n")}`);

  // Solo perfiles con 8 o más sesiones (los guardados antes con menos no se muestran hasta recalcularlos)
  const responseProfiles = await prisma.athleteResponseProfile.findMany({ where: { athleteId, sessionsCount: { gte: 8 } } });
  if (responseProfiles.length > 0) {
    const lines = responseProfiles.map(
      (p) => `- ${p.stimulusType}: HRV promedio ${(p.avgHrvImpactNextDayPct ?? 0) > 0 ? "+" : ""}${p.avgHrvImpactNextDayPct?.toFixed(1).replace(".", ",")}% al día siguiente vs su línea de 7 días (n=${p.sessionsCount})`
    );
    parts.push(`PERFIL DE RESPUESTA INDIVIDUAL (aprendido del historial; solo figuran los tipos con 8 o más sesiones y un cambio mayor al ruido propio de su HRV). Es una TENDENCIA observada, no una causa: otros factores (sueño, estrés, la sesión del día anterior) también mueven la HRV, y es un criterio de diseño del sistema, no de un estudio:\n${lines.join("\n")}`);
  }

  if (focusedWorkoutId) {
    const workout = await prisma.generatedWorkout.findFirst({ where: { id: focusedWorkoutId, athleteId } });
    if (workout) {
      const blocks = workout.blocksJson as unknown as Blk[];
      const dayKey = new Date(workout.date).toISOString().split("T")[0];
      const totalMin = Math.round(blocks.reduce((s, b) => s + (b.durationSec ?? 0), 0) / 60);
      focusParts.push(
        [
          `SESIÓN EN FOCO — el atleta la tiene abierta ahora y es de lo que habla cuando dice "esta sesión", "la sesión" o "ella". Nunca le pidas que te la describa ni digas que no la ves: tenés todos sus datos acá.`,
          `Es una sesión PLANIFICADA para ${relativeDay(dayKey)} (${new Date(workout.date).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}), tipo ${STIMULUS_LABELS[workout.workoutLibraryKey] ?? workout.workoutLibraryKey}, estado ${workout.status}.`,
          `Duración ${totalMin}min, TSS estimado ${workout.estimatedTss ?? "?"}, ${workout.estimatedKj != null ? `${Math.round(workout.estimatedKj)} kJ, ` : ""}carbohidratos sugeridos ${workout.suggestedCarbsG ?? "?"} g.`,
          `Estructura: ${summarizeBlocks(blocks)}`,
          workout.rationale ? `Fundamento con el que el plan la eligió: ${workout.rationale}` : "",
          `Bloques exactos (JSON; si pide un cambio, devolvé el array completo actualizado): ${JSON.stringify(workout.blocksJson)}`,
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
  }

  if (focusedActivityId) {
    const a = await prisma.activity.findFirst({
      where: { id: focusedActivityId, athleteId },
      include: { generatedWorkout: { select: { workoutLibraryKey: true, estimatedTss: true, blocksJson: true } } },
    });
    if (a) {
      const zt = ((a.rawStreamsJson as { zoneTimes?: { id: string; secs: number }[] } | null)?.zoneTimes ?? [])
        .filter((z) => z.secs > 0)
        .map((z) => `${z.id} ${Math.round(z.secs / 60)}min`)
        .join(", ");
      const stimulus = classifyStimulusType({ type: a.type, name: a.name, intensityFactor: a.intensityFactor, rawStreamsJson: a.rawStreamsJson });
      const f = (v: number | null | undefined, d = 0, u = "") => (v == null ? "?" : `${v.toFixed(d)}${u}`);
      const lines = [
        `SESIÓN EN FOCO — el atleta tiene abierta esta actividad YA REALIZADA y es de lo que habla cuando dice "esta sesión", "la sesión" o "ella". Nunca le pidas que te la describa ni digas que no la ves: tenés todos sus datos acá. No se puede modificar, solo analizarla.`,
        `Actividad del ${a.date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} (${relativeDay(a.date.toISOString().slice(0, 10))}): "${a.name ?? a.type}", tipo detectado ${STIMULUS_LABELS[stimulus] ?? stimulus}`,
        `Duración ${Math.round(a.durationSec / 60)}min, TSS ${f(a.tss)}, IF ${f(a.intensityFactor != null && a.intensityFactor > 3 ? a.intensityFactor / 100 : a.intensityFactor, 2)}, NP ${f(a.normalizedPower, 0, "W")}, potencia media ${f(a.avgPower, 0, "W")}, VI ${f(a.variabilityIndex, 2)}`,
        `FC media ${f(a.avgHr, 0, "lpm")}, FC máx ${f(a.maxHr, 0, "lpm")}, cadencia ${f(a.avgCadence, 0, "rpm")}, trabajo ${f(a.kilojoules, 0, "kJ")}, desacople Pw:HR ${f(a.decouplingPct, 1, "%")}`,
        zt ? `Tiempo por zona: ${zt}` : `Tiempo por zona: sin datos`,
      ];
      if (RIDE_TYPES_SET.has(a.type)) {
        const nrow = await prisma.activity.findUnique({ where: { id: a.id }, select: NUTRITION_SELECT });
        if (nrow) {
          const input = toNutritionInput(nrow);
          lines.push(`Nutrición durante la sesión (registrada por el atleta): ${describeSessionNutrition(toSessionNutrition(input), input)}`);
        }
      }
      const rated = describeRatings(a.rpe, a.feel);
      if (rated) {
        lines.push(`Percepción del atleta tras la salida (la cargó él): ${rated}. El RPE va de 1 (nada) a 10 (máximo); la sensación, de «fuerte» a «sin fuerzas».`);
        const prevRated = await prisma.activity.findMany({
          where: { athleteId, id: { not: a.id }, date: { lt: a.date }, rpe: { not: null } },
          orderBy: { date: "desc" },
          take: 6,
          select: { rpe: true, feel: true, intensityFactor: true, date: true, name: true },
        });
        const prior = prevRated.filter((p) => validRpe(p.rpe)).map((p) => ({ rpe: p.rpe as number, feel: p.feel, ifr: ifRatio(p.intensityFactor), label: p.date.toISOString().slice(0, 10) }));
        lines.push(...readRatings({ rpe: a.rpe, feel: a.feel, durationMin: Math.round(a.durationSec / 60), intensityFactor: a.intensityFactor, variabilityIndex: a.variabilityIndex, prior }));
        if (prior.length) lines.push(`Sesiones anteriores con RPE (de la más reciente): ${prior.slice(0, 5).map((p) => `${p.label} RPE ${p.rpe}${p.ifr != null ? ` (IF ${p.ifr.toFixed(2).replace(".", ",")})` : ""}`).join("; ")}.`);
      }
      if (RIDE_TYPES_SET.has(a.type)) {
        const wtxt = describeWeather(await ensureActivityWeather(a.id).catch(() => ({ weather: null, deviceTemp: null })));
        if (wtxt) lines.push(wtxt);
      }
      if (a.deviationFlag !== "NONE") lines.push(`Desvío vs plan: ${a.deviationFlag}${a.deviationNotes ? ` — ${a.deviationNotes}` : ""}`);
      // Vueltas del archivo original (o intervalos de Intervals.icu como respaldo): nunca debe romper el contexto
      const lapsData = RIDE_TYPES_SET.has(a.type) ? await ensureActivityLaps(a.id).catch((e) => { console.error("ensureActivityLaps falló", e); return null; }) : null;
      const summary = (a.rawStreamsJson as { intervalSummary?: unknown } | null)?.intervalSummary;
      if (lapsData) {
        lines.push(describeLaps(lapsData, user?.ftp));
        if (summary) lines.push(`Resumen automático de Intervals.icu (puede ser impreciso; si no coincide con las vueltas, usá las vueltas): ${JSON.stringify(summary)}`);
      } else if (summary) lines.push(`Intervalos detectados por Intervals.icu en la actividad (detección automática, puede omitir o fusionar intervalos): ${JSON.stringify(summary)}`);
      if (a.generatedWorkout) {
        const pb = a.generatedWorkout.blocksJson as unknown as Blk[];
        lines.push(
          `Sesión planificada asociada: ${STIMULUS_LABELS[a.generatedWorkout.workoutLibraryKey] ?? a.generatedWorkout.workoutLibraryKey}, TSS planeado ${a.generatedWorkout.estimatedTss}, duración planeada ${Math.round(pb.reduce((x, b) => x + (b.durationSec ?? 0), 0) / 60)}min.`,
          (() => {
            const pm = Math.round(pb.reduce((x, b) => x + (b.durationSec ?? 0), 0) / 60);
            const rm = Math.round(a.durationSec / 60);
            const pct = (real: number, plan: number) => (plan > 0 ? `${real >= plan ? "+" : "−"}${Math.abs(Math.round(((real - plan) / plan) * 1000) / 10).toString().replace(".", ",")}%` : "?");
            return `Real vs plan (calculado, usalo tal cual): duración ${rm} min vs ${pm} planeados (${pct(rm, pm)})${a.tss != null && a.generatedWorkout!.estimatedTss ? `; TSS ${Math.round(a.tss)} vs ${a.generatedWorkout!.estimatedTss} planeado (${pct(a.tss, a.generatedWorkout!.estimatedTss)})` : ""}.`;
          })(),
          `Estructura PLANIFICADA exacta: ${summarizeBlocks(pb)}`,
          `Para comparar plan vs real usá SOLO esta estructura planificada y los datos reales de arriba; si un dato real (por ejemplo la cantidad de series o repeticiones) no figura, decí que no lo sabés en vez de suponerlo. Nunca inventes la estructura planificada.`
        );
      } else {
        lines.push(`Sin sesión planificada asociada (actividad libre o todavía no vinculada): no afirmes qué estaba planificado.`);
      }
      focusParts.push(lines.join("\n"));
    }
  }

  return [...focusParts, ...parts].join("\n\n");
}