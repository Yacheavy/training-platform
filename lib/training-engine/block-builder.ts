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

function buildWarmupHiit(ftp: number): WorkoutBlock[] {
  const z1Watts = Math.round(ftp * 0.5);
  const z2Watts = Math.round(ftp * 0.65);
  const activationWatts = Math.round(ftp * 1.15);

  return [
    { type: "warmup_z1", durationSec: 600, targetWatts: z1Watts },
    { type: "warmup_z2", durationSec: 1200, targetWatts: z2Watts },
    { type: "warmup_activation", durationSec: 10, targetWatts: activationWatts },
    { type: "warmup_recovery", durationSec: 300, targetWatts: z1Watts },
    { type: "warmup_activation", durationSec: 10, targetWatts: activationWatts },
    { type: "warmup_recovery", durationSec: 300, targetWatts: z1Watts },
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
  progressionStep: number = 0
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
    const warmup = buildWarmupHiit(ftp);
    const warmupSec = warmup.reduce((s, b) => s + b.durationSec, 0);
    const cooldownSec = 600;

    const progression = getHiitProgression(progressionStep);
    const intervalSec = progression.intervalSec;
    const recoverySec = progression.recoverySec;
    const availableForIntervals = totalSec - warmupSec - cooldownSec;
    const reps = Math.max(1, Math.min(progression.reps, Math.floor(availableForIntervals / (intervalSec + recoverySec))));

    const blocks: WorkoutBlock[] = [...warmup];
    for (let i = 0; i < reps; i++) {
      blocks.push({ type: "interval", durationSec: intervalSec, targetWatts });
      blocks.push({ type: "recovery", durationSec: recoverySec, targetWatts: z2Watts });
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
    const blockSec = stimulusType === "sweet_spot" ? 1200 : 480;
    const recoverySec = 300;
    const availableForIntervals = totalSec - warmupSec - cooldownSec;
    const reps = Math.max(1, Math.min(4, Math.floor(availableForIntervals / (blockSec + recoverySec))));

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
    const numSeries = stimulusType === "rst" ? 4 : stimulusType === "billat_30_30" ? 1 : 3;
    const restBetweenSeriesSec = 180;

    const blocks: WorkoutBlock[] = [...buildWarmupZ2(warmupSec, ftp)];
    for (let s = 0; s < numSeries; s++) {
      for (let i = 0; i < repsPerSeries; i++) {
        blocks.push({ type: "interval", durationSec: shortInterval, targetWatts });
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