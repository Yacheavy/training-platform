import { prisma } from "@/lib/prisma";
import { calculateAvailability } from "./availability";
import { buildBlocks } from "./block-builder";
import { calculateTss } from "./tss";
import { calculateFueling } from "./fueling";

const OBJECTIVE_TO_STIMULUS: Record<string, string> = {
  vo2max: "hiit_genuino",
  umbral: "umbral",
  base: "sweet_spot",
  tapering: "z2",
};

async function pickQualityStimulus(athleteId: string, rationale: string[]): Promise<string> {
  const today = new Date();
  const activeBlock = await prisma.trainingBlock.findFirst({
    where: { athleteId, startDate: { lte: today }, endDate: { gte: today } },
  });

  let candidate = "sweet_spot";
  if (activeBlock) {
    candidate = OBJECTIVE_TO_STIMULUS[activeBlock.objective] ?? "sweet_spot";
    rationale.push(`Bloque activo "${activeBlock.name}" (objetivo: ${activeBlock.objective}) → sugiere ${candidate}`);
  } else {
    rationale.push("Sin bloque de entrenamiento activo configurado — usando sweet_spot como opción de calidad por defecto");
  }

  const library = await prisma.workoutLibraryEntry.findUnique({ where: { key: candidate } });
  if (library?.maxSessionsPerWeek != null) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCount = await prisma.generatedWorkout.count({
      where: { athleteId, workoutLibraryKey: candidate, date: { gte: sevenDaysAgo } },
    });
    if (recentCount >= library.maxSessionsPerWeek) {
      rationale.push(`Ya alcanzaste el máximo semanal de ${candidate} (${library.maxSessionsPerWeek}/sem) — bajando a sweet_spot`);
      candidate = "sweet_spot";
    }
  }

  return candidate;
}

/**
 * Genera el workout de "desde cero" — el comportamiento original, usado
 * como FALLBACK cuando no existe un PLANNED para hoy (por ejemplo, si
 * todavía no generaste un plan completo con generateFullPlan).
 */
async function generateFromScratch(athleteId: string, forceDayOfWeek?: number) {
  const user = await prisma.user.findUnique({ where: { id: athleteId } });
  if (!user?.ftp) {
    return { error: "Configurá tu FTP en el perfil antes de generar sugerencias" };
  }

  const dayOfWeek = forceDayOfWeek ?? new Date().getDay();
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

  if (slot.stimulusType === "gym") {
    effectiveStimulusType = "gym";
  } else if (slot.stimulusType === "cycling") {
    effectiveStimulusType = slot.isQualityDay
      ? await pickQualityStimulus(athleteId, rationale)
      : "z2";
    if (!slot.isQualityDay) rationale.push("Día de volumen (no calidad) → z2 por defecto");
  } else {
    effectiveStimulusType = "z2";
  }

  const availability = await calculateAvailability(athleteId);

  if (availability.status === "RED" && effectiveStimulusType !== "z2" && effectiveStimulusType !== "gym") {
    rationale.push(`⚠ Disponibilidad RED (${availability.reasons.join("; ")}) — bajado a Z2 en vez de ${effectiveStimulusType}`);
    effectiveStimulusType = "z2";
  } else if (availability.status === "AMBER") {
    rationale.push(`Disponibilidad AMBER (${availability.reasons.join("; ")}) — se mantiene el estímulo`);
  } else {
    rationale.push(`Disponibilidad GREEN (${availability.reasons.join("; ")})`);
  }

  const library = await prisma.workoutLibraryEntry.findUnique({ where: { key: effectiveStimulusType } });
  const duration = slot.targetDurationMin ?? 60;

  const blocks = buildBlocks(
    effectiveStimulusType,
    duration,
    user.ftp,
    library?.intensityPctFtpLow ?? null,
    library?.intensityPctFtpHigh ?? null
  );

  const tss = calculateTss(blocks, user.ftp);
  const fueling = calculateFueling(blocks);

  const workout = await prisma.generatedWorkout.create({
    data: {
      athleteId,
      date: new Date(),
      workoutLibraryKey: effectiveStimulusType,
      status: "SUGGESTED",
      blocksJson: blocks,
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
    const diff = forceDayOfWeek - targetDate.getDay();
    targetDate.setDate(targetDate.getDate() + diff);
  }
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const planned = await prisma.generatedWorkout.findFirst({
    where: { athleteId, date: { gte: startOfDay, lte: endOfDay }, status: "PLANNED" },
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

  if (availability.status === "RED" && finalStimulusType !== "z2" && finalStimulusType !== "gym") {
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
    const fueling = calculateFueling(finalBlocks);

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