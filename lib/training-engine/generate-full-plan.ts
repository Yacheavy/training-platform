import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma";
import { buildMesocycleWeeks } from "./mesocycle-builder";
import { buildBlocks } from "./block-builder";
import { calculateTss } from "./tss";
import { calculateFueling } from "./fueling";

const OBJECTIVE_TO_STIMULUS: Record<string, string> = {
  vo2max: "hiit_genuino",
  umbral: "umbral",
  base: "sweet_spot",
  tapering: "z2",
};

const ALTERNATIVE_TO_STIMULUS: Record<string, string> = {
  vo2max: "ronnestad_30_15",
  umbral: "sweet_spot",
  base: "z2",
  tapering: "z2",
};

function assignWeeklyQualityStimuli(
  count: number,
  objective: string,
  primaryMaxPerWeek: number | null
): string[] {
  const primary = OBJECTIVE_TO_STIMULUS[objective] ?? "sweet_spot";
  const alternative = ALTERNATIVE_TO_STIMULUS[objective] ?? "sweet_spot";
  const cap = primaryMaxPerWeek ?? count;

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(i < cap ? primary : alternative);
  }
  return result;
}

function getFtpTestStimulusType(protocol: string | undefined): string {
  if (protocol === "8min") return "ftp_test_8min";
  if (protocol === "5min") return "ftp_test_5min";
  return "ftp_test";
}

/**
 * Calcula en qué semanas (índice) corresponde el test de FTP, evitando
 * que coincida con una semana de deload — si coincide, se reprograma a
 * la última semana de carga ANTES del deload (nunca se cancela).
 */
function computeFtpTestWeekIndices(
  totalWeeks: number,
  weeksBetweenFtpTest: number,
  mesocycleWeeks: { isDeload: boolean }[]
): Set<number> {
  const indices = new Set<number>();
  if (weeksBetweenFtpTest <= 0) return indices;

  for (let w = weeksBetweenFtpTest - 1; w < totalWeeks; w += weeksBetweenFtpTest) {
    let candidate = w;
    if (mesocycleWeeks[candidate]?.isDeload) {
      candidate = w - 1; // última semana de carga antes del deload
    }
    if (candidate >= 0 && !mesocycleWeeks[candidate]?.isDeload) {
      indices.add(candidate);
    }
  }
  return indices;
}

export async function generateFullPlan(trainingBlockId: string) {
  const block = await prisma.trainingBlock.findUnique({ where: { id: trainingBlockId } });
  if (!block) throw new Error("Bloque no encontrado");

  const user = await prisma.user.findUnique({ where: { id: block.athleteId } });
  if (!user?.ftp) throw new Error("Configurá tu FTP antes de generar un plan completo");

  const thresholds = await prisma.athleteThresholds.findUnique({ where: { athleteId: block.athleteId } });
  const deloadRatio = thresholds?.deloadRatio ?? "4:1";
  const weeksBetweenFtpTest = thresholds?.weeksBetweenFtpTest ?? 5;
  const ftpTestStimulusType = getFtpTestStimulusType(thresholds?.ftpTestProtocol);

  const template = await prisma.trainingTemplateSlot.findMany({ where: { athleteId: block.athleteId } });
  const slotByDay = new Map(template.map((t) => [t.dayOfWeek, t]));

  const qualityDaySlots = template
    .filter((t) => t.stimulusType === "cycling" && t.isQualityDay)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const startDate = new Date(block.startDate);
  const endDate = new Date(block.endDate);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.ceil(totalDays / 7);

  const mesocycleWeeks = buildMesocycleWeeks(totalWeeks, deloadRatio);
  const ftpTestWeekIndices = computeFtpTestWeekIndices(totalWeeks, weeksBetweenFtpTest, mesocycleWeeks);

  const primaryStimulus = OBJECTIVE_TO_STIMULUS[block.objective] ?? "sweet_spot";
  const primaryLibrary = await prisma.workoutLibraryEntry.findUnique({ where: { key: primaryStimulus } });

  const baseStimuliForWeek = assignWeeklyQualityStimuli(
    qualityDaySlots.length,
    block.objective,
    primaryLibrary?.maxSessionsPerWeek ?? null
  );

  const created: string[] = [];
  const skipped: string[] = [];

  for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayOffset);
    const dayOfWeek = date.getDay();

    const slot = slotByDay.get(dayOfWeek);
    if (!slot || slot.stimulusType === "rest") continue;

    const weekIndex = Math.floor(dayOffset / 7);
    const mesocycleWeek = mesocycleWeeks[weekIndex] ?? mesocycleWeeks[mesocycleWeeks.length - 1];

    const isFtpTestWeek = ftpTestWeekIndices.has(weekIndex);
    const isFirstQualityDayOfWeek = qualityDaySlots.length > 0 && qualityDaySlots[0].dayOfWeek === dayOfWeek;

    let effectiveStimulusType: string;

    if (slot.stimulusType === "gym") {
      effectiveStimulusType = "gym";
    } else if (slot.isQualityDay) {
      if (isFtpTestWeek && isFirstQualityDayOfWeek) {
        effectiveStimulusType = ftpTestStimulusType;
      } else if (mesocycleWeek.isDeload) {
        effectiveStimulusType = "z2";
      } else {
        const positionInWeek = qualityDaySlots.findIndex((s) => s.dayOfWeek === dayOfWeek);
        effectiveStimulusType = baseStimuliForWeek[positionInWeek] ?? primaryStimulus;
      }
    } else {
      effectiveStimulusType = "z2";
    }

    const library = await prisma.workoutLibraryEntry.findUnique({ where: { key: effectiveStimulusType } });
    const baseDuration = slot.targetDurationMin ?? 60;
    const targetDuration = Math.round(baseDuration * mesocycleWeek.loadMultiplier);

    const progressionStep = effectiveStimulusType === "hiit_genuino" ? mesocycleWeek.progressionStep : 0;

    const blocks = buildBlocks(
      effectiveStimulusType,
      targetDuration,
      user.ftp,
      library?.intensityPctFtpLow ?? null,
      library?.intensityPctFtpHigh ?? null,
      progressionStep
    );

    const tss = calculateTss(blocks, user.ftp);
    const fueling = calculateFueling(blocks);

    const rationaleParts = [
      `Plan del bloque "${block.name}" — semana ${weekIndex + 1} del mesociclo${mesocycleWeek.isDeload ? " (DELOAD, -45% volumen)" : ""}`,
    ];
    if (effectiveStimulusType.startsWith("ftp_test")) {
      rationaleParts.push(`Test de FTP programado (protocolo ${thresholds?.ftpTestProtocol ?? "20min"}) — protocolo práctico de la industria, no ensayo controlado`);
    } else if (slot.isQualityDay) {
      const isPrimary = effectiveStimulusType === primaryStimulus;
      rationaleParts.push(
        `Día de calidad → ${effectiveStimulusType}${isPrimary ? " (estímulo principal del objetivo)" : " (alternativa — cupo semanal del principal ya asignado a otro día)"}${effectiveStimulusType === "hiit_genuino" ? ` · progresión semana ${mesocycleWeek.progressionStep + 1} según Chicharro & Vicente-Campos 2018` : ""}`
      );
    } else {
      rationaleParts.push("Día de volumen → z2");
    }
    const rationale = rationaleParts.join(" · ");

    try {
      const existing = await prisma.generatedWorkout.findFirst({
        where: { athleteId: block.athleteId, date: { gte: date, lt: new Date(date.getTime() + 86400000) }, status: "PLANNED" },
      });
      if (existing) {
        skipped.push(date.toISOString().split("T")[0]);
        continue;
      }

      await prisma.generatedWorkout.create({
        data: {
          athleteId: block.athleteId,
          date,
          workoutLibraryKey: effectiveStimulusType,
          status: "PLANNED",
          blocksJson: blocks as unknown as Prisma.InputJsonValue,
          estimatedTss: tss,
          estimatedKj: fueling.totalKj,
          suggestedCarbsG: fueling.suggestedCarbsG,
          suggestedCarbsGPerHour: fueling.suggestedCarbsGPerHour,
          requiresMultipleCarbSources: fueling.requiresMultipleCarbSources,
          rationale,
        },
      });
      created.push(date.toISOString().split("T")[0]);
    } catch (err) {
      skipped.push(`${date.toISOString().split("T")[0]} (error: ${String(err)})`);
    }
  }

  return { created: created.length, skipped: skipped.length, createdDates: created, skippedDates: skipped };
}