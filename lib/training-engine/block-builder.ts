import { WorkoutBlock } from "./tss";

function buildWarmupZ2(totalSec: number, ftp: number): WorkoutBlock[] {
  const z1Watts = Math.round(ftp * 0.5);
  const z2Watts = Math.round(ftp * 0.65);
  const z1Sec = Math.min(600, Math.round(totalSec * 0.4));
  const z2Sec = totalSec - z1Sec;
  return [
    { type: "warmup_z1", durationSec: z1Sec, targetWatts: z1Watts },
    { type: "warmup_z2", durationSec: z2Sec, targetWatts: z2Watts },
  ];
}

/**
 * Calentamiento específico para sesiones de VO2max (base de conocimiento,
 * Chicharro & Vicente-Campos 2018): 10min a umbral láctico (VT1, ~72% FTP; NO
 * el MLSS/VT2) + 2 intervalos de 1min a intensidad MLSS/VT2 (~FTP) con 30s de
 * recuperación activa. Total: 13min.
 */
function buildWarmupVo2(ftp: number): WorkoutBlock[] {
  const z1Watts = Math.round(ftp * 0.5);
  const thresholdWatts = Math.round(ftp * 0.72); // VT1 (umbral aeróbico)
  const primerWatts = ftp;

  return [
    { type: "warmup_z2", durationSec: 600, targetWatts: thresholdWatts },
    { type: "warmup_activation", durationSec: 60, targetWatts: primerWatts },
    { type: "warmup_recovery", durationSec: 30, targetWatts: z1Watts },
    { type: "warmup_activation", durationSec: 60, targetWatts: primerWatts },
    { type: "warmup_recovery", durationSec: 30, targetWatts: z1Watts },
  ];
}

function buildCooldown(totalSec: number, ftp: number): WorkoutBlock[] {
  const z1Watts = Math.round(ftp * 0.5);
  const z2Watts = Math.round(ftp * 0.6);
  const z2Sec = Math.round(totalSec * 0.6);
  const z1Sec = totalSec - z2Sec;
  return [
    { type: "cooldown_z2", durationSec: z2Sec, targetWatts: z2Watts },
    { type: "cooldown_z1", durationSec: z1Sec, targetWatts: z1Watts },
  ];
}

function getHiitProgression(step: number): { intervalSec: number; reps: number; recoverySec: number } {
  const table = [
    { intervalSec: 180, reps: 7, recoverySec: 180 },
    { intervalSec: 240, reps: 7, recoverySec: 180 },
    { intervalSec: 240, reps: 10, recoverySec: 180 },
    { intervalSec: 240, reps: 10, recoverySec: 120 },
  ];
  const clampedStep = Math.min(step, table.length - 1);
  return table[clampedStep];
}

export function buildBlocks(
  stimulusType: string,
  targetDurationMin: number,
  ftp: number,
  intensityPctLow: number | null,
  intensityPctHigh: number | null,
  progressionStep: number = 0,
  seriesOverride?: number,
  pvo2maxWatts?: number | null,
  maintenance: boolean = false
): WorkoutBlock[] {
  const totalSec = targetDurationMin * 60;
  const z2Watts = Math.round(ftp * 0.68);

  if (stimulusType === "gym") {
    return [{ type: "gym", durationSec: totalSec, targetWatts: 0 }];
  }

  if (stimulusType === "ftp_test" || stimulusType === "ftp_test_8min" || stimulusType === "ftp_test_5min") {
    const z1Watts = Math.round(ftp * 0.5);
    const z2WattsTest = Math.round(ftp * 0.65);
    const blowoutWatts = Math.round(ftp * 1.05);
    const warmup: WorkoutBlock[] = [
      { type: "warmup_z1", durationSec: 600, targetWatts: z1Watts },
      { type: "warmup_z2", durationSec: 600, targetWatts: z2WattsTest },
      { type: "warmup_blowout", durationSec: 300, targetWatts: blowoutWatts },
      { type: "warmup_recovery", durationSec: 600, targetWatts: z1Watts },
    ];
    const cooldown: WorkoutBlock[] = [
      { type: "cooldown_z2", durationSec: 360, targetWatts: z2WattsTest },
      { type: "cooldown_z1", durationSec: 240, targetWatts: z1Watts },
    ];

    if (stimulusType === "ftp_test_5min") {
      return [...warmup, { type: "test_5min", durationSec: 300, targetWatts: Math.round(ftp * 1.2) }, ...cooldown];
    }
    if (stimulusType === "ftp_test_8min") {
      return [
        ...warmup,
        { type: "test_8min", durationSec: 480, targetWatts: Math.round(ftp * 1.05) },
        { type: "recovery", durationSec: 600, targetWatts: z2WattsTest },
        { type: "test_8min", durationSec: 480, targetWatts: Math.round(ftp * 1.05) },
        ...cooldown,
      ];
    }
    return [...warmup, { type: "test_20min", durationSec: 1200, targetWatts: ftp }, ...cooldown];
  }

  if (stimulusType === "z2") {
    const warmupSec = Math.min(900, Math.round(totalSec * 0.15));
    const cooldownSec = Math.min(600, Math.round(totalSec * 0.1));
    const mainSec = totalSec - warmupSec - cooldownSec;

    return [
      ...buildWarmupZ2(warmupSec, ftp),
      { type: "z2", durationSec: mainSec, targetWatts: z2Watts },
      ...buildCooldown(cooldownSec, ftp),
    ];
  }

  const midPct = intensityPctLow && intensityPctHigh ? (intensityPctLow + intensityPctHigh) / 2 : 90;
  const targetWatts = Math.round(ftp * (midPct / 100));

  if (stimulusType === "hiit_genuino") {
    const warmup = buildWarmupVo2(ftp);
    const cooldownSec = 900; // libro: ~15 min suaves (70-80% de VT1)

    const progression = getHiitProgression(progressionStep);
    const intervalSec = progression.intervalSec;
    const recoverySec = progression.recoverySec;
    // El protocolo manda: las repeticiones NO se recortan al tiempo del slot
    // (si no entran, la sesión dura lo que el protocolo necesita).
    // Mantenimiento (deload/taper): mitad de repeticiones (mín. 3), misma intensidad
    const reps = maintenance ? Math.max(3, Math.ceil(progression.reps / 2)) : progression.reps;

    // Base de conocimiento (Chicharro & Vicente-Campos 2018): HIIT genuino al 100% de la
    // potencia en VO2max y recuperación activa ~50%. Sin dato medido se usa el %FTP de la librería.
    const intervalWatts = pvo2maxWatts ? Math.round(pvo2maxWatts) : targetWatts;
    // Sin PAM medida, la recuperación también es ~50% de la potencia objetivo del intervalo (no Z2 de la librería).
    const recoveryWatts = Math.round(intervalWatts * 0.5);

    const blocks: WorkoutBlock[] = [...warmup];
    for (let i = 0; i < reps; i++) {
      blocks.push({ type: "interval", durationSec: intervalSec, targetWatts: intervalWatts });
      if (i < reps - 1) blocks.push({ type: "recovery", durationSec: recoverySec, targetWatts: recoveryWatts });
    }

    const usedSecBeforeCooldown = blocks.reduce((s, b) => s + b.durationSec, 0);
    const cooldownBlocks = buildCooldown(cooldownSec, ftp);
    const cooldownSecTotal = cooldownBlocks.reduce((s, b) => s + b.durationSec, 0);
    const fillSec = totalSec - usedSecBeforeCooldown - cooldownSecTotal;
    if (fillSec > 60) blocks.push({ type: "z2_fill", durationSec: fillSec, targetWatts: z2Watts });

    blocks.push(...cooldownBlocks);

    return blocks;
  }

  const warmupSec = Math.min(1200, Math.round(totalSec * 0.2));
  const cooldownSec = Math.min(600, Math.round(totalSec * 0.12));

  if (stimulusType === "sweet_spot" || stimulusType === "umbral") {
    // Progresión por mesociclo: sweet spot 20→25→30 min, umbral 8→10→12 min (práctica de
    // entrenadores; no hay ensayos que validen una progresión concreta)
    const step = Math.min(2, Math.max(0, progressionStep));
    const blockSec = stimulusType === "sweet_spot" ? [1200, 1500, 1800][step] : [480, 600, 720][step];
    const recoverySec = 300;
    const availableForIntervals = totalSec - warmupSec - cooldownSec;
    let reps = Math.max(1, Math.min(4, Math.floor(availableForIntervals / (blockSec + recoverySec))));
    if (maintenance) reps = Math.max(1, Math.ceil(reps / 2));

    const blocks: WorkoutBlock[] = [...buildWarmupZ2(warmupSec, ftp)];
    for (let i = 0; i < reps; i++) {
      blocks.push({ type: "interval", durationSec: blockSec, targetWatts });
      if (i < reps - 1) blocks.push({ type: "recovery", durationSec: recoverySec, targetWatts: z2Watts });
    }

    const usedSecBeforeCooldown = blocks.reduce((s, b) => s + b.durationSec, 0);
    const cooldownBlocks = buildCooldown(cooldownSec, ftp);
    const cooldownSecTotal = cooldownBlocks.reduce((s, b) => s + b.durationSec, 0);
    const fillSec = totalSec - usedSecBeforeCooldown - cooldownSecTotal;
    if (fillSec > 60) blocks.push({ type: "z2_fill", durationSec: fillSec, targetWatts: z2Watts });

    blocks.push(...cooldownBlocks);

    return blocks;
  }

  /**
   * Rønnestad 30/15: 3 series de 13x(30s/15s), 3min entre series (protocolo real).
   * Billat 30-30: series de 30s/30s "hasta el fallo" — usamos 15 reps como
   * aproximación práctica de duración típica, no un tope fisiológico exacto.
   * RST: 4 series de 6x(5-6s/24-25s), 3min entre series (fosfágenos).
   * ANTES de este fix, esta rama llenaba TODO el tiempo disponible sin
   * límite, generando 80+ repeticiones irreales para sesiones largas.
   */
  if (stimulusType === "ronnestad_30_15" || stimulusType === "billat_30_30" || stimulusType === "rst") {
    const shortInterval = stimulusType === "rst" ? 6 : 30;
    const shortRecovery = stimulusType === "rst" ? 24 : stimulusType === "billat_30_30" ? 30 : 15;
    const repsPerSeries = stimulusType === "rst" ? 6 : stimulusType === "billat_30_30" ? 15 : 13;
    const defaultSeries = stimulusType === "rst" ? 4 : stimulusType === "billat_30_30" ? 1 : 3;
    // Dosis progresiva (práctica de entrenadores, no dosis de los estudios): el generador
    // puede pedir menos series que el protocolo completo.
    const numSeries = seriesOverride ?? defaultSeries;
    const restBetweenSeriesSec = 180;

    // Libro (cap. 2): HIIT corto a 100-110% de la PAM. Con PAM medida se usa 105%, con tope de
    // 140% FTP (carga neuromuscular); sin PAM, el %FTP de la librería.
    const shortWatts =
      pvo2maxWatts && stimulusType !== "rst"
        ? Math.min(Math.round(pvo2maxWatts * 1.05), Math.round(ftp * 1.4))
        : targetWatts;

    const blocks: WorkoutBlock[] = [...buildWarmupVo2(ftp)];
    for (let s = 0; s < numSeries; s++) {
      for (let i = 0; i < repsPerSeries; i++) {
        blocks.push({ type: "interval", durationSec: shortInterval, targetWatts: shortWatts });
        blocks.push({ type: "recovery", durationSec: shortRecovery, targetWatts: z2Watts });
      }
      if (s < numSeries - 1) {
        blocks.push({ type: "recovery", durationSec: restBetweenSeriesSec, targetWatts: z2Watts });
      }
    }

    const usedSecBeforeCooldown = blocks.reduce((s, b) => s + b.durationSec, 0);
    const cooldownBlocks = buildCooldown(cooldownSec, ftp);
    const cooldownSecTotal = cooldownBlocks.reduce((s, b) => s + b.durationSec, 0);
    const fillSec = totalSec - usedSecBeforeCooldown - cooldownSecTotal;
    if (fillSec > 60) blocks.push({ type: "z2_fill", durationSec: fillSec, targetWatts: z2Watts });

    blocks.push(...cooldownBlocks);
    return blocks;
  }

  // Fallback defensivo si algún tipo no matcheó ninguna rama anterior
  return [
    ...buildWarmupZ2(warmupSec, ftp),
    { type: "z2", durationSec: totalSec - warmupSec - cooldownSec, targetWatts: z2Watts },
    ...buildCooldown(cooldownSec, ftp),
  ];
}