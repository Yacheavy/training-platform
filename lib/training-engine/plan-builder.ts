import { buildMesocycleWeeks } from "./mesocycle-builder";
import { buildBlocks } from "./block-builder";
import { calculateTss, WorkoutBlock } from "./tss";
import { calculateFueling, FuelingResult } from "./fueling";
import { OBJECTIVE_TO_STIMULUS, assignWeeklyQualityStimuli } from "./quality-assignment";
import { dayOfWeekLocal } from "../tz";

/**
 * Planificador PURO (sin base de datos): dado el bloque, el FTP, los umbrales,
 * la plantilla semanal y la librería, devuelve el plan día por día. Lo usan
 * generateFullPlan (persistencia) y los chequeos de invariantes.
 */
export interface PlanBlockInput {
  name: string;
  objective: string;
  startDate: Date;
  endDate: Date;
}
export interface PlanThresholds {
  deloadRatio: string;
  weeksBetweenFtpTest: number;
  ftpTestProtocol?: string | null;
}
export interface PlanTemplateSlot {
  dayOfWeek: number;
  stimulusType: string;
  isQualityDay: boolean;
  targetDurationMin: number | null;
}
export interface PlanLibraryEntry {
  intensityPctFtpLow: number | null;
  intensityPctFtpHigh: number | null;
  maxSessionsPerWeek: number | null;
}
export interface PlannedDay {
  date: Date;
  dayOffset: number;
  weekIndex: number;
  dayOfWeek: number;
  isDeload: boolean;
  isQualityDay: boolean;
  stimulusType: string;
  blocks: WorkoutBlock[];
  tss: number;
  fueling: FuelingResult;
  rationale: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getFtpTestStimulusType(protocol: string | null | undefined): string {
  if (protocol === "8min") return "ftp_test_8min";
  if (protocol === "5min") return "ftp_test_5min";
  return "ftp_test";
}

/**
 * Semanas (índice) del test de FTP, evitando semanas de deload: si coincide,
 * se reprograma a la última semana de carga ANTES del deload (nunca se cancela).
 */
export function computeFtpTestWeekIndices(
  totalWeeks: number,
  weeksBetweenFtpTest: number,
  mesocycleWeeks: { isDeload: boolean }[]
): Set<number> {
  const indices = new Set<number>();
  if (weeksBetweenFtpTest <= 0) return indices;
  for (let w = weeksBetweenFtpTest - 1; w < totalWeeks; w += weeksBetweenFtpTest) {
    let candidate = w;
    if (mesocycleWeeks[candidate]?.isDeload) candidate = w - 1;
    if (candidate >= 0 && !mesocycleWeeks[candidate]?.isDeload) indices.add(candidate);
  }
  return indices;
}

/** Series de Rønnestad según la posición en el mesociclo: 1 → 2 → 3; tras el deload se retoma en 2. */
export function ronnestadSeriesFor(weekIndex: number, cycleLength: number): number {
  const positionInCycle = weekIndex % cycleLength;
  return Math.min(3, (weekIndex < cycleLength ? 1 : 2) + positionInCycle);
}

export function buildPlan(input: {
  block: PlanBlockInput;
  ftp: number;
  thresholds: PlanThresholds;
  template: PlanTemplateSlot[];
  library: Record<string, PlanLibraryEntry | undefined>;
}): PlannedDay[] {
  const { block, ftp, thresholds, template, library } = input;

  const slotByDay = new Map(template.map((t) => [t.dayOfWeek, t]));
  const qualityDaySlots = template
    .filter((t) => t.stimulusType === "cycling" && t.isQualityDay)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const totalDays = Math.ceil((block.endDate.getTime() - block.startDate.getTime()) / DAY_MS);
  const totalWeeks = Math.ceil(totalDays / 7);

  const mesocycleWeeks = buildMesocycleWeeks(totalWeeks, thresholds.deloadRatio);
  const cycleLength = (parseInt(thresholds.deloadRatio.split(":")[0], 10) || 3) + 1;
  const ftpTestWeekIndices = computeFtpTestWeekIndices(totalWeeks, thresholds.weeksBetweenFtpTest, mesocycleWeeks);
  const ftpTestStimulusType = getFtpTestStimulusType(thresholds.ftpTestProtocol);

  const primaryStimulus = OBJECTIVE_TO_STIMULUS[block.objective] ?? "sweet_spot";
  const baseStimuliForWeek = assignWeeklyQualityStimuli(
    qualityDaySlots.map((s) => s.dayOfWeek),
    block.objective,
    library[primaryStimulus]?.maxSessionsPerWeek ?? null
  );

  const days: PlannedDay[] = [];

  for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
    const date = new Date(block.startDate.getTime() + dayOffset * DAY_MS);
    const dayOfWeek = dayOfWeekLocal(date);

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

    const lib = library[effectiveStimulusType];
    const targetDuration = Math.round((slot.targetDurationMin ?? 60) * mesocycleWeek.loadMultiplier);

    // Un escalón de progresión del HIIT genuino por mesociclo (cada 4-6 semanas según la base de conocimiento).
    const progressionStep = effectiveStimulusType === "hiit_genuino" ? Math.floor(weekIndex / cycleLength) : 0;
    const series = effectiveStimulusType === "ronnestad_30_15" ? ronnestadSeriesFor(weekIndex, cycleLength) : undefined;

    const blocks = buildBlocks(
      effectiveStimulusType,
      targetDuration,
      ftp,
      lib?.intensityPctFtpLow ?? null,
      lib?.intensityPctFtpHigh ?? null,
      progressionStep,
      series
    );

    const rationaleParts = [
      `Plan del bloque "${block.name}" — semana ${weekIndex + 1} del mesociclo${mesocycleWeek.isDeload ? " (DELOAD, -45% volumen)" : ""}`,
    ];
    if (effectiveStimulusType.startsWith("ftp_test")) {
      rationaleParts.push(
        `Test de FTP programado (protocolo ${thresholds.ftpTestProtocol ?? "20min"}) — protocolo práctico de la industria, no ensayo controlado`
      );
    } else if (slot.isQualityDay) {
      const isPrimary = effectiveStimulusType === primaryStimulus;
      const detail =
        effectiveStimulusType === "hiit_genuino"
          ? ` · progresión escalón ${progressionStep + 1} según Chicharro & Vicente-Campos 2018`
          : effectiveStimulusType === "ronnestad_30_15"
            ? ` · ${series} serie${series === 1 ? "" : "s"} de 13×(30s/15s) (progresivo 1→3)`
            : "";
      rationaleParts.push(
        `Día de calidad → ${effectiveStimulusType}${isPrimary ? " (estímulo principal del objetivo)" : " (alternativa — máx. 1 por semana, ≥48h del estímulo principal)"}${detail}`
      );
    } else if (slot.stimulusType === "gym") {
      rationaleParts.push("Día de gimnasio");
    } else {
      rationaleParts.push("Día de volumen → z2");
    }

    days.push({
      date,
      dayOffset,
      weekIndex,
      dayOfWeek,
      isDeload: mesocycleWeek.isDeload,
      isQualityDay: slot.isQualityDay,
      stimulusType: effectiveStimulusType,
      blocks,
      tss: calculateTss(blocks, ftp),
      fueling: calculateFueling(blocks),
      rationale: rationaleParts.join(" · "),
    });
  }

  return days;
}
