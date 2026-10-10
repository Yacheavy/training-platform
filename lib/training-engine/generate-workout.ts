import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma";
import { calculateAvailability } from "./availability";
import { buildBlocks } from "./block-builder";
import { calculateTss } from "./tss";
import { calculateFueling } from "./fueling";
import { buildMesocycleWeeks } from "./mesocycle-builder";
import { primaryStimulusFor, ALTERNATIVE_TO_STIMULUS, MIN_GAP_DAYS_BETWEEN_VO2MAX } from "./quality-assignment";
import { ronnestadSeriesFor } from "./plan-builder";
import { isVo2Key } from "./variants";
import { dayOfWeekLocal, dayStartLocal, dayRangeLocal } from "../tz";
import { buildGymSession, buildFlexSession, gymBlocks } from "./strength";
import { isOffBike } from "./off-bike";

const DAY_MS = 24 * 60 * 60 * 1000;

interface QualityContext {
  stimulusType: string;
  isDeload: boolean;
  loadMultiplier: number;
  weekIndex: number;
  cycleLength: number;
  /** Deload: se conserva UNA sesión de intensidad con volumen reducido (igual que el planificador). */
  maintenance: boolean;
}

const MAINTAINABLE = new Set(["hiit_genuino", "ronnestad_30_15", "sweet_spot", "umbral"]);

/**
 * Elige el estímulo de calidad de HOY aplicando las MISMAS reglas que el
 * planificador (quality-assignment): estímulo principal del objetivo,
 * máx. semanal por librería, ≥48h entre sesiones VO2max, 1 alternativa
 * (Rønnestad) cuando el principal está agotado, y deload → Z2.
 * Nunca cae silenciosamente a otro estímulo: cada decisión queda en el rationale.
 */
async function pickQualityStimulus(athleteId: string, today: Date, rationale: string[]): Promise<QualityContext> {
  const activeBlock = await prisma.trainingBlock.findFirst({
    where: { athleteId, startDate: { lte: today }, endDate: { gte: today } },
  });
  const thresholds = await prisma.athleteThresholds.findFirst({ where: { athleteId } });
  const deloadRatio = thresholds?.deloadRatio ?? "4:1";
  const cycleLength = (parseInt(deloadRatio.split(":")[0], 10) || 3) + 1;

  let weekIndex = 0;
  let isDeload = false;
  let loadMultiplier = 1;
  if (activeBlock) {
    weekIndex = Math.max(0, Math.floor((today.getTime() - activeBlock.startDate.getTime()) / (7 * DAY_MS)));
    const totalWeeks = Math.ceil((activeBlock.endDate.getTime() - activeBlock.startDate.getTime()) / (7 * DAY_MS));
    const meso = buildMesocycleWeeks(Math.max(totalWeeks, weekIndex + 1), deloadRatio)[weekIndex];
    isDeload = meso.isDeload;
    loadMultiplier = meso.loadMultiplier;
  }
  const ctx = (stimulusType: string, maintenance = false): QualityContext => ({ stimulusType, isDeload, loadMultiplier, weekIndex, cycleLength, maintenance });

  if (!activeBlock) {
    rationale.push("Sin bloque de entrenamiento activo configurado — usando sweet_spot como opción de calidad por defecto");
    return ctx("sweet_spot");
  }

  const primary = primaryStimulusFor(activeBlock.objective, thresholds?.vo2Stimulus, weekIndex);
  rationale.push(`Bloque activo "${activeBlock.name}" (objetivo: ${activeBlock.objective}) → sugiere ${primary}`);

  const since = new Date(today.getTime() - 7 * DAY_MS);
  const recent = await prisma.generatedWorkout.findMany({
    where: { athleteId, date: { gte: since, lt: dayStartLocal(today) } },
    select: { workoutLibraryKey: true, date: true },
  });
  const lastVo2 = recent
    .filter((r) => (isVo2Key(r.workoutLibraryKey) || r.workoutLibraryKey === "billat_30_30" || r.workoutLibraryKey === "rst"))
    .map((r) => r.date.getTime())
    .sort((x, y) => y - x)[0];
  if (lastVo2 != null && dayStartLocal(today).getTime() - dayStartLocal(new Date(lastVo2)).getTime() < MIN_GAP_DAYS_BETWEEN_VO2MAX * DAY_MS) {
    rationale.push(`Sesión VO2max hace menos de ${MIN_GAP_DAYS_BETWEEN_VO2MAX} días (≥48h de separación) → Z2`);
    return ctx("z2");
  }

  if (isDeload) {
    // Igual que el planificador: en la descarga baja el volumen y se mantiene la intensidad
    // (una sesión, con la mitad de repeticiones), salvo que ya haya habido una esta semana.
    const hadQuality = recent.some((r) => MAINTAINABLE.has(r.workoutLibraryKey));
    if (MAINTAINABLE.has(primary) && !hadQuality) {
      rationale.push(`Semana de DELOAD → una sesión de ${primary} de mantenimiento (mitad de repeticiones, misma intensidad)`);
      return ctx(primary, true);
    }
    rationale.push("Semana de DELOAD → sin más calidad, Z2");
    return ctx("z2");
  }

  const countOf = (key: string) => recent.filter((r) => r.workoutLibraryKey === key).length;
  const lib = await prisma.workoutLibraryEntry.findUnique({ where: { key: primary } });
  if (lib?.maxSessionsPerWeek != null && countOf(primary) >= lib.maxSessionsPerWeek) {
    const alt = ALTERNATIVE_TO_STIMULUS[activeBlock.objective];
    if (alt && countOf(alt) < 1) {
      rationale.push(`Máximo semanal de ${primary} (${lib.maxSessionsPerWeek}/sem) alcanzado — alternativa del objetivo: ${alt} (máx. 1/sem)`);
      return ctx(alt);
    }
    rationale.push(`Máximo semanal de ${primary} (${lib.maxSessionsPerWeek}/sem) alcanzado y sin alternativa disponible → Z2`);
    return ctx("z2");
  }
  return ctx(primary);
}

/**
 * Genera el workout de "desde cero" — el comportamiento original, usado
 * como FALLBACK cuando no existe un PLANNED para hoy (por ejemplo, si
 * todavía no generaste un plan completo con generateFullPlan).
 */
async function generateFromScratch(athleteId: string, forceDayOfWeek?: number) {
  const user = await prisma.user.findUnique({ where: { id: athleteId } });
  if (!user?.ftp) {
    return { error: "Cargá tu FTP en Ajustes antes de generar sugerencias" };
  }

  const now = new Date();
  const dayOfWeek = forceDayOfWeek ?? dayOfWeekLocal(now);
  const slot = await prisma.trainingTemplateSlot.findUnique({
    where: { athleteId_dayOfWeek: { athleteId, dayOfWeek } },
  });

  if (!slot || slot.stimulusType === "rest") {
    return { restDay: true, message: "Hoy es día de descanso según tu plantilla" };
  }

  const rationale: string[] = [
    `Plantilla: ${slot.stimulusType}${slot.isQualityDay ? " (calidad)" : ""} los ${["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][dayOfWeek]}`,
  ];

  let effectiveStimulusType: string;
  let quality: QualityContext | null = null;

  if (slot.stimulusType === "gym") {
    effectiveStimulusType = "gym";
  } else if (slot.stimulusType === "flexibility") {
    effectiveStimulusType = "flexibility";
  } else if (slot.stimulusType === "cycling") {
    if (slot.isQualityDay) {
      quality = await pickQualityStimulus(athleteId, now, rationale);
      effectiveStimulusType = quality.stimulusType;
    } else {
      effectiveStimulusType = "z2";
    }
    if (!slot.isQualityDay) rationale.push("Día de volumen (no calidad) → z2 por defecto");
  } else {
    effectiveStimulusType = "z2";
  }

  const availability = await calculateAvailability(athleteId);

  if (availability.status === "RED" && effectiveStimulusType !== "z2" && !isOffBike(effectiveStimulusType)) {
    rationale.push(`⚠ Disponibilidad RED (${availability.reasons.join("; ")}) — bajado a Z2 en vez de ${effectiveStimulusType}`);
    effectiveStimulusType = "z2";
  } else if (availability.status === "AMBER") {
    rationale.push(`Disponibilidad AMBER (${availability.reasons.join("; ")}) — se mantiene el estímulo`);
  } else {
    rationale.push(`Disponibilidad GREEN (${availability.reasons.join("; ")})`);
  }

  const library = await prisma.workoutLibraryEntry.findUnique({ where: { key: effectiveStimulusType } });
  const duration = Math.round((slot.targetDurationMin ?? 60) * (quality?.loadMultiplier ?? 1));
  // Mismo criterio que el planificador: un escalón por mesociclo en HIIT genuino, sweet spot y umbral
  const progressionStep =
    ["hiit_genuino", "sweet_spot", "umbral"].includes(effectiveStimulusType) && quality ? Math.floor(quality.weekIndex / quality.cycleLength) : 0;
  const series =
    (effectiveStimulusType === "ronnestad_30_15" || effectiveStimulusType === "z2_sprints") && quality
      ? quality.maintenance
        ? 1
        : ronnestadSeriesFor(quality.weekIndex, quality.cycleLength)
      : undefined;

  // Gimnasio y flexibilidad: sesión con ejercicios (sin el contexto del plan: criterio genérico de fuerza)
  const thr = await prisma.athleteThresholds.findUnique({ where: { athleteId }, select: { flexibilityEnabled: true } });
  const offBike =
    effectiveStimulusType === "gym"
      ? gymBlocks(buildGymSession({ slotMin: duration, objective: "base", weekIndex: 1, cycleLength: 4, isDeload: false, isTaperWeek: false, gymIndexInWeek: 0, gymCountInWeek: 1, nextDayHard: false, mobilityMin: thr?.flexibilityEnabled ? 8 : 0 }))
      : effectiveStimulusType === "flexibility"
        ? gymBlocks(buildFlexSession(duration))
        : null;

  const blocks = offBike ?? buildBlocks(
    effectiveStimulusType,
    duration,
    user.ftp,
    library?.intensityPctFtpLow ?? null,
    library?.intensityPctFtpHigh ?? null,
    progressionStep,
    series,
    user.pvo2maxWatts,
    quality?.maintenance ?? false
  );

  const tss = calculateTss(blocks, user.ftp);
  const fueling = calculateFueling(blocks, user.ftp);

  const workout = await prisma.generatedWorkout.create({
    data: {
      athleteId,
      date: now,
      workoutLibraryKey: effectiveStimulusType,
      status: "SUGGESTED",
      blocksJson: blocks as unknown as Prisma.InputJsonValue,
      estimatedTss: tss,
      estimatedKj: fueling.totalKj,
      suggestedCarbsG: fueling.suggestedCarbsG,
      suggestedCarbsGPerHour: fueling.suggestedCarbsGPerHour,
      requiresMultipleCarbSources: fueling.requiresMultipleCarbSources,
      rationale: rationale.join(" · "),
    },
  });

  return { workout, availability, source: "scratch" };
}

/**
 * PUNTO DE ENTRADA PRINCIPAL. Primero busca si ya existe un PLANNED para
 * hoy (generado de antemano por generateFullPlan). Si existe, lo VALIDA
 * contra la disponibilidad real de hoy — confirma tal cual o ajusta,
 * explicando el motivo. Si NO existe ningún PLANNED (por ejemplo, todavía
 * no generaste un plan completo para este bloque), cae al comportamiento
 * original de generar desde cero.
 */
export async function generateTodayWorkout(athleteId: string, forceDayOfWeek?: number) {
  const targetDate = new Date();
  if (forceDayOfWeek != null) {
    const diff = forceDayOfWeek - dayOfWeekLocal(targetDate);
    targetDate.setTime(targetDate.getTime() + diff * DAY_MS);
  }
  const { start: startOfDay, end: endOfDay } = dayRangeLocal(targetDate);

  const planned = await prisma.generatedWorkout.findFirst({
    where: { athleteId, date: { gte: startOfDay, lt: endOfDay }, status: "PLANNED" },
  });

  if (!planned) {
    return generateFromScratch(athleteId, forceDayOfWeek);
  }

  // Hay un PLANNED — lo validamos contra la disponibilidad real de hoy
  const availability = await calculateAvailability(athleteId);
  const user = await prisma.user.findUnique({ where: { id: athleteId } });

  const rationale: string[] = [planned.rationale ?? "Sesión planeada"];
  let finalStimulusType = planned.workoutLibraryKey;
  let finalBlocks = planned.blocksJson as unknown as { type: string; durationSec: number; targetWatts: number }[];
  let wasModifiedToday = false;

  if (availability.status === "RED" && finalStimulusType !== "z2" && !isOffBike(finalStimulusType)) {
    rationale.push(`⚠ VALIDACIÓN DIARIA: disponibilidad RED (${availability.reasons.join("; ")}) — se ajusta el plan de hoy a Z2 en vez de ${finalStimulusType}`);
    finalStimulusType = "z2";
    wasModifiedToday = true;

    if (user?.ftp) {
      const totalMin = Math.round(finalBlocks.reduce((s, b) => s + b.durationSec, 0) / 60);
      finalBlocks = buildBlocks("z2", totalMin, user.ftp, null, null);
    }
  } else if (availability.status === "AMBER") {
    rationale.push(`Validación diaria: disponibilidad AMBER (${availability.reasons.join("; ")}) — se mantiene el plan tal cual estaba`);
  } else {
    rationale.push(`Validación diaria: disponibilidad GREEN (${availability.reasons.join("; ")}) — plan confirmado tal cual estaba planeado`);
  }

  let updated = planned;
  if (wasModifiedToday && user?.ftp) {
    const tss = calculateTss(finalBlocks, user.ftp);
    const fueling = calculateFueling(finalBlocks, user.ftp);

    updated = await prisma.generatedWorkout.update({
      where: { id: planned.id },
      data: {
        workoutLibraryKey: finalStimulusType,
        blocksJson: finalBlocks,
        estimatedTss: tss,
        estimatedKj: fueling.totalKj,
        suggestedCarbsG: fueling.suggestedCarbsG,
        suggestedCarbsGPerHour: fueling.suggestedCarbsGPerHour,
        requiresMultipleCarbSources: fueling.requiresMultipleCarbSources,
        rationale: rationale.join(" · "),
        status: "SUGGESTED", // deja de ser "PLANNED" una vez validado/ajustado
      },
    });
  } else {
    updated = await prisma.generatedWorkout.update({
      where: { id: planned.id },
      data: { rationale: rationale.join(" · "), status: "SUGGESTED" },
    });
  }

  return { workout: updated, availability, source: "planned_validated", wasModifiedToday };
}