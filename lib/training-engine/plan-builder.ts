import { buildMesocycleWeeks } from "./mesocycle-builder";
import { buildBlocks, sprintCountFor } from "./block-builder";
import { calculateTss, WorkoutBlock } from "./tss";
import { calculateFueling, FuelingResult } from "./fueling";
import { assignWeeklyQualityStimuli, primaryStimulusFor } from "./quality-assignment";
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
  /** Preferencia de VO2max: hiit_genuino | ronnestad_30_15 | alternate (solo objetivo vo2max). */
  vo2Stimulus?: string | null;
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
  /** Duración objetivo del slot (min, ya con el multiplicador de carga), para avisar si el protocolo la excede. */
  slotTargetMin?: number;
}

const MAINTAINABLE = new Set(["hiit_genuino", "ronnestad_30_15", "sweet_spot", "umbral"]);
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
    // Preferimos la primera semana tras un deload (atleta descansado → test válido).
    let candidate = -1;
    let bestDist = Infinity;
    for (let i = 1; i < totalWeeks; i++) {
      if (mesocycleWeeks[i - 1]?.isDeload && !mesocycleWeeks[i]?.isDeload) {
        const d = Math.abs(i - w);
        if (d <= 2 && d < bestDist && !indices.has(i)) {
          candidate = i;
          bestDist = d;
        }
      }
    }
    if (candidate < 0) {
      candidate = mesocycleWeeks[w]?.isDeload ? w - 1 : w;
      if (candidate >= 0 && indices.has(candidate)) continue;
    }
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
  pvo2maxWatts?: number | null;
  thresholds: PlanThresholds;
  template: PlanTemplateSlot[];
  library: Record<string, PlanLibraryEntry | undefined>;
}): PlannedDay[] {
  const { block, ftp, pvo2maxWatts, thresholds, template, library } = input;

  const slotByDay = new Map(template.map((t) => [t.dayOfWeek, t]));
  const qualityDaySlots = template
    .filter((t) => t.stimulusType === "cycling" && t.isQualityDay)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const totalDays = Math.ceil((block.endDate.getTime() - block.startDate.getTime()) / DAY_MS);
  const totalWeeks = Math.ceil(totalDays / 7);

  const isTapering = block.objective === "tapering";
  // Taper (Bosquet 2007): sin ciclos de deload; el volumen baja ~40-55% en las últimas 2 semanas
  // manteniendo intensidad y frecuencia. Antes de eso, carga normal.
  const mesocycleWeeks = isTapering
    ? Array.from({ length: totalWeeks }, (_, i) => {
        const fromEnd = totalWeeks - 1 - i;
        return {
          weekNumber: i + 1,
          isDeload: false,
          loadMultiplier: fromEnd === 0 ? 0.45 : fromEnd === 1 ? 0.6 : 1.0,
          progressionStep: 0,
        };
      })
    : buildMesocycleWeeks(totalWeeks, thresholds.deloadRatio);
  const taperWeek = (i: number) => isTapering && totalWeeks - 1 - i <= 1;
  const cycleLength = (parseInt(thresholds.deloadRatio.split(":")[0], 10) || 3) + 1;
  const ftpTestWeekIndices = computeFtpTestWeekIndices(totalWeeks, thresholds.weeksBetweenFtpTest, mesocycleWeeks);
  const ftpTestStimulusType = getFtpTestStimulusType(thresholds.ftpTestProtocol);

  // La asignación semanal depende del estímulo principal de ESA semana (alternar → cambia por semana)
  const assignedCache = new Map<string, string[]>();
  const stimuliForWeek = (primary: string) => {
    let a = assignedCache.get(primary);
    if (!a) {
      a = assignWeeklyQualityStimuli(qualityDaySlots.map((s) => s.dayOfWeek), block.objective, library[primary]?.maxSessionsPerWeek ?? null, primary);
      assignedCache.set(primary, a);
    }
    return a;
  };

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
    const primaryStimulus = primaryStimulusFor(block.objective, thresholds.vo2Stimulus, weekIndex);
    const baseStimuliForWeek = stimuliForWeek(primaryStimulus);

    let effectiveStimulusType: string;
    let maintenance = false;
    if (slot.stimulusType === "gym") {
      effectiveStimulusType = "gym";
    } else if (slot.isQualityDay) {
      if (isFtpTestWeek && isFirstQualityDayOfWeek) {
        effectiveStimulusType = ftpTestStimulusType;
      } else if (mesocycleWeek.isDeload || taperWeek(weekIndex)) {
        // Deload/taper: se conserva UNA sesión de intensidad con volumen reducido
        // (la intensidad es lo que se mantiene; el volumen es lo que baja).
        const keep = isFirstQualityDayOfWeek && MAINTAINABLE.has(isTapering ? "hiit_genuino" : primaryStimulus);
        const positionInWeek = qualityDaySlots.findIndex((s) => s.dayOfWeek === dayOfWeek);
        // El rodaje con sprints (baja fatiga) se conserva en descarga con una sola serie
        const keepSprints = !keep && !isTapering && baseStimuliForWeek[positionInWeek] === "z2_sprints";
        effectiveStimulusType = keep ? (isTapering ? "hiit_genuino" : primaryStimulus) : keepSprints ? "z2_sprints" : "z2";
        maintenance = keep || keepSprints;
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
    const progressionStep = ["hiit_genuino", "sweet_spot", "umbral"].includes(effectiveStimulusType)
      ? Math.floor(weekIndex / cycleLength)
      : 0;
    // Series: Rønnestad 30/15 y rodaje con sprints comparten la progresión 1→2→3 (criterio propio)
    const series =
      effectiveStimulusType === "ronnestad_30_15" || effectiveStimulusType === "z2_sprints"
        ? maintenance
          ? 1
          : ronnestadSeriesFor(weekIndex, cycleLength)
        : undefined;

    const blocks = buildBlocks(
      effectiveStimulusType,
      targetDuration,
      ftp,
      lib?.intensityPctFtpLow ?? null,
      lib?.intensityPctFtpHigh ?? null,
      progressionStep,
      series,
      pvo2maxWatts,
      maintenance
    );

    const rationaleParts = [
      `Plan del bloque "${block.name}" — semana ${weekIndex + 1} del mesociclo${mesocycleWeek.isDeload ? " (DELOAD, -45% volumen, se mantiene 1 sesión de intensidad reducida)" : taperWeek(weekIndex) ? " (TAPER: volumen reducido, intensidad y frecuencia conservadas — Bosquet 2007)" : ""}`,
    ];
    if (effectiveStimulusType.startsWith("ftp_test")) {
      rationaleParts.push(
        `Test de FTP programado (protocolo ${thresholds.ftpTestProtocol ?? "20min"}) — protocolo práctico de la industria, no ensayo controlado`
      );
    } else if (slot.isQualityDay) {
      const isPrimary = effectiveStimulusType === primaryStimulus;
      const detail =
        effectiveStimulusType === "hiit_genuino"
          ? ` · progresión escalón ${progressionStep + 1} según Chicharro & Vicente-Campos 2018${pvo2maxWatts ? ` · intervalos al 100% de tu potencia en VO2max (${Math.round(pvo2maxWatts)} W)` : " · intensidad por %FTP (cargá tu potencia en VO2max en Configuración)"}`
          : effectiveStimulusType === "ronnestad_30_15"
            ? ` · ${series} serie${series === 1 ? "" : "s"} de 13×(30s/15s) (progresivo 1→3)`
            : effectiveStimulusType === "z2_sprints"
              ? ` · ${sprintCountFor(series ?? 3, maintenance)} sprints de 30" a máxima potencia dentro de un rodaje Z2 (Rønnestad 2020 usó 9; evidencia preliminar en ciclistas de élite; progresión 5→7→9 = criterio propio)`
              : "";
      rationaleParts.push(
        `Día de calidad → ${effectiveStimulusType}${isPrimary ? " (estímulo principal del objetivo)" : effectiveStimulusType === "z2_sprints" ? " (segundo estímulo de baja fatiga — máx. 1 por semana, ≥48h del principal)" : " (alternativa — máx. 1 por semana, ≥48h del estímulo principal)"}${detail}`
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
      fueling: calculateFueling(blocks, ftp),
      rationale: rationaleParts.join(" · "),
      slotTargetMin: targetDuration,
    });
  }

  return days;
}
