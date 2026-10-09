import { buildMesocycleWeeks } from "./mesocycle-builder";
import { buildBlocks, sprintCountFor } from "./block-builder";
import { calculateTss, WorkoutBlock } from "./tss";
import { calculateFueling, FuelingResult } from "./fueling";
import { assignWeeklyQualityStimuli, assignWeeklyQualityRoles, primaryStimulusFor, QualityRole } from "./quality-assignment";
import { pickVariant, normalizeLevel, HistoryEntry, SlotRole } from "./variety";
import { VARIANTS } from "./variants";
import { MID_INTENSITY_KEYS, type IntensityGuard } from "./autoregulation";
import { dayOfWeekLocal, dateKeyLocal } from "../tz";

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
  /** Preferencia de VO2max: hiit_genuino | ronnestad_30_15 | alternate | rotate (solo objetivo vo2max). */
  vo2Stimulus?: string | null;
  /** Nivel de variedad: conservative | balanced | varied (por defecto balanced). */
  varietyLevel?: string | null;
  /** Variantes que el atleta vetó. */
  bannedStimuli?: string[] | null;
  /** linear (por defecto) | block: semana intensificada al inicio de cada mesociclo (solo VO2max). */
  periodization?: string | null;
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
  /** Rol de la sesión en la semana (solo ciclismo con selector de variantes). */
  role?: SlotRole;
  /** Semana intensificada de la periodización por bloques. */
  intensified?: boolean;
}

/** Variantes con escalón de progresión por mesociclo (calendario; Fase 2 lo ajustará con la ejecución real). */
const PROGRESSION_KEYS = new Set(["hiit_genuino", "sweet_spot", "umbral", "vo2_long", "over_under", "endurance_tempo", "long_durability"]);
/** Variantes con series 1→3 (criterio propio, igual que Rønnestad). */
const SERIES_KEYS = new Set(["ronnestad_30_15", "z2_sprints", "sprint_neuro"]);
/** Un slot de ciclismo de al menos esta duración (min) se trata como salida larga. */
export const LONG_SLOT_MIN = 150;
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
  /** Sesiones previas al plan (dayOffset negativo) para que la rotación continúe entre planes. */
  history?: HistoryEntry[];
  /** Variantes a excluir por fecha local (YYYY-MM-DD): botón "Otra variante". */
  excludeByDate?: Record<string, string[]>;
  /** Sesiones ya existentes (dayOffset → clave) que reemplazan a la simulación en el historial interno. */
  fixedKeys?: Record<number, string>;
  /** Ajuste de progresión por variante según la ejecución real (±1 escalón). */
  execution?: Record<string, { adjust: number; reason: string }>;
  /** Protección de distribución de intensidad (aplica hasta `guardUntilOffset`, inclusive). */
  guard?: IntensityGuard | null;
  guardUntilOffset?: number;
}): PlannedDay[] {
  const { block, ftp, pvo2maxWatts, thresholds, template, library } = input;
  const level = normalizeLevel(thresholds.varietyLevel);
  const banned = new Set(thresholds.bannedStimuli ?? []);
  const ledger: HistoryEntry[] = [...(input.history ?? [])];
  const keyByOffset = new Map<number, string>(ledger.map((h) => [h.dayOffset, h.key]));
  const rolesCache = new Map<string, QualityRole[]>();
  const rolesForWeek = (primary: string, intensified: boolean): QualityRole[] => {
    const ck = `${primary}|${intensified}`;
    let r = rolesCache.get(ck);
    if (!r) {
      r = assignWeeklyQualityRoles(qualityDaySlots.map((s) => s.dayOfWeek), block.objective, library[primary]?.maxSessionsPerWeek ?? null, intensified);
      rolesCache.set(ck, r);
    }
    return r;
  };

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
    // Periodización por bloques (adaptación propia inspirada en Rønnestad 2014): la primera semana de carga de cada
    // mesociclo concentra 2 sesiones principales de VO2max (el estudio usó 5); el resto de las semanas, 1.
    const intensifiedWeek =
      thresholds.periodization === "block" && block.objective === "vo2max" && !isTapering && !mesocycleWeek.isDeload && weekIndex % cycleLength === 0 && qualityDaySlots.length >= 2 && !isFtpTestWeek;
    const isFirstQualityDayOfWeek = qualityDaySlots.length > 0 && qualityDaySlots[0].dayOfWeek === dayOfWeek;
    const primaryStimulus = primaryStimulusFor(block.objective, thresholds.vo2Stimulus, weekIndex);
    const baseStimuliForWeek = stimuliForWeek(primaryStimulus);

    let effectiveStimulusType: string;
    let maintenance = false;
    let role: SlotRole | undefined;
    let varietyReason = "";
    const prevKey = keyByOffset.get(dayOffset - 1) ?? null;
    // Un test de FTP el día anterior cuenta como sesión dura para el rodaje siguiente
    const prevDayKey = prevKey && prevKey.startsWith("ftp_test") ? "umbral" : prevKey;
    const guard = input.guard ?? null;
    const guardOn = !!guard && dayOffset <= (input.guardUntilOffset ?? -1);
    const qualityPos = qualityDaySlots.findIndex((s) => s.dayOfWeek === dayOfWeek);
    const nextSlot = slotByDay.get((dayOfWeek + 1) % 7);
    const nextIsQuality = !!nextSlot && nextSlot.stimulusType === "cycling" && nextSlot.isQualityDay;
    const excludeSet = new Set<string>(input.excludeByDate?.[dateKeyLocal(date)] ?? []);
    const pick = (r: SlotRole, deload: boolean, fullSlot = false) => {
      const ex = new Set(excludeSet);
      // Esfuerzo final largo el día antes de una sesión de calidad: no
      if (nextIsQuality) ex.add("long_durability");
      if (guardOn && guard?.avoidMid && r !== "primary") for (const k of MID_INTENSITY_KEYS) ex.add(k);
      return pickVariant({
        role: r,
        objective: block.objective,
        level,
        vo2Stimulus: thresholds.vo2Stimulus,
        weekIndex,
        dayOffset,
        allowRepeat: intensifiedWeek && r === "primary",
        slotMin: fullSlot ? (slot.targetDurationMin ?? 60) : Math.round((slot.targetDurationMin ?? 60) * mesocycleWeek.loadMultiplier),
        isDeload: deload,
        history: ledger,
        banned,
        exclude: ex,
        prevDayKey,
      });
    };

    if (slot.stimulusType === "gym") {
      effectiveStimulusType = "gym";
    } else if (isFtpTestWeek && slot.isQualityDay && isFirstQualityDayOfWeek) {
      effectiveStimulusType = ftpTestStimulusType;
    } else if (isTapering) {
      // Taper: lógica original (sin selector de variantes)
      if (slot.isQualityDay) {
        if (taperWeek(weekIndex)) {
          const keep = isFirstQualityDayOfWeek;
          const keepSprints = !keep && baseStimuliForWeek[qualityPos] === "z2_sprints";
          effectiveStimulusType = keep ? "hiit_genuino" : keepSprints ? "z2_sprints" : "z2";
          maintenance = keep || keepSprints;
        } else {
          effectiveStimulusType = baseStimuliForWeek[qualityPos] ?? primaryStimulus;
        }
      } else {
        effectiveStimulusType = "z2";
      }
    } else {
      const roles = rolesForWeek(primaryStimulus, intensifiedWeek);
      const qRole = slot.isQualityDay ? roles[qualityPos] : undefined;
      const dropSecondary = qRole === "secondary" && guardOn && !!guard?.dropSecondary;
      if (dropSecondary) varietyReason = guard!.reason;
      if ((qRole === "primary" || qRole === "secondary") && !dropSecondary) {
        role = qRole;
        if (mesocycleWeek.isDeload) {
          // Deload: se conserva UNA sesión de intensidad con volumen reducido (si la variante lo admite)
          const p = pick(qRole, false, true);
          const keepIt = isFirstQualityDayOfWeek ? !!VARIANTS[p.key]?.maintainable && qRole === "primary" : !!VARIANTS[p.key]?.maintainable && VARIANTS[p.key]?.neuro;
          if (keepIt) {
            effectiveStimulusType = p.key;
            maintenance = true;
            varietyReason = p.reason;
          } else {
            effectiveStimulusType = "z2";
            role = "volume";
          }
        } else {
          const p = pick(qRole, false);
          effectiveStimulusType = p.key;
          varietyReason = p.reason;
        }
      } else {
        role = (slot.targetDurationMin ?? 60) >= LONG_SLOT_MIN ? "long" : "volume";
        const p = pick(role, mesocycleWeek.isDeload);
        effectiveStimulusType = p.key;
        varietyReason = dropSecondary ? `${varietyReason} · ${p.reason}` : p.reason;
      }
    }

    const fixed = input.fixedKeys?.[dayOffset];
    if (fixed && !isTapering && effectiveStimulusType !== "gym" && !effectiveStimulusType.startsWith("ftp_test") && VARIANTS[fixed]) {
      effectiveStimulusType = fixed;
    }
    if (!isTapering && effectiveStimulusType !== "gym" && !effectiveStimulusType.startsWith("ftp_test")) {
      ledger.push({ dayOffset, key: effectiveStimulusType });
    }
    keyByOffset.set(dayOffset, effectiveStimulusType);

    const lib = library[effectiveStimulusType];
    const targetDuration = Math.round((slot.targetDurationMin ?? 60) * mesocycleWeek.loadMultiplier);

    // Un escalón de progresión por mesociclo (cada 4-6 semanas según la base de conocimiento).
    const exec = input.execution?.[effectiveStimulusType];
    const adj = exec && !maintenance ? exec.adjust : 0;
    const progressionStep = PROGRESSION_KEYS.has(effectiveStimulusType) ? Math.max(0, Math.floor(weekIndex / cycleLength) + adj) : 0;
    // Series: Rønnestad 30/15, rodaje con sprints y sprints cortos comparten la progresión 1→3 (criterio propio)
    const series = SERIES_KEYS.has(effectiveStimulusType) ? (maintenance ? 1 : Math.min(3, Math.max(1, ronnestadSeriesFor(weekIndex, cycleLength) + adj))) : undefined;

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
    } else if (slot.isQualityDay || (role && effectiveStimulusType !== "gym")) {
      const isPrimary = role ? role === "primary" : effectiveStimulusType === primaryStimulus;
      const detail =
        effectiveStimulusType === "hiit_genuino"
          ? ` · progresión escalón ${progressionStep + 1} según Chicharro & Vicente-Campos 2018${pvo2maxWatts ? ` · intervalos al 100% de tu potencia en VO2max (${Math.round(pvo2maxWatts)} W)` : " · intensidad por %FTP (cargá tu potencia en VO2max en Ajustes)"}`
          : effectiveStimulusType === "ronnestad_30_15"
            ? ` · ${series} serie${series === 1 ? "" : "s"} de 13×(30s/15s) (progresivo 1→3)`
            : effectiveStimulusType === "z2_sprints"
              ? ` · ${sprintCountFor(series ?? 3, maintenance)} sprints de 30" a máxima potencia dentro de un rodaje Z2 (Rønnestad 2020 usó 9; evidencia preliminar en ciclistas de élite; progresión 5→7→9 = criterio propio)`
              : "";
      const v = VARIANTS[effectiveStimulusType];
      const evidence = v ? ` · evidencia: ${v.evidence === "ensayo" ? "ensayos" : v.evidence === "preliminar" ? "preliminar" : v.evidence === "practica" ? "práctica de entrenadores" : v.evidence === "hipotesis" ? "hipótesis" : "no concluyente"}` : "";
      if (intensifiedWeek && role === "primary") rationaleParts.push("Semana intensificada (periodización por bloques, adaptación propia inspirada en Rønnestad 2014): 2 sesiones de VO2max esta semana y 1 por semana en las siguientes");
      const head = role === "volume" || role === "long"
        ? `${role === "long" ? "Salida larga" : "Rodaje"} → ${effectiveStimulusType}`
        : `Día de calidad → ${effectiveStimulusType}${isPrimary ? " (estímulo principal del objetivo)" : " (segundo estímulo — ≥48h del principal)"}`;
      rationaleParts.push(`${head}${detail}${evidence}`);
      if (varietyReason) rationaleParts.push(varietyReason);
      if (exec && adj !== 0 && (PROGRESSION_KEYS.has(effectiveStimulusType) || SERIES_KEYS.has(effectiveStimulusType))) rationaleParts.push(exec.reason);
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
      role,
      intensified: intensifiedWeek || undefined,
    });
  }

  return days;
}
