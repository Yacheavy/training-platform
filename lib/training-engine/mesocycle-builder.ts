export interface MicrocycleWeek {
  weekNumber: number;
  isDeload: boolean;
  loadMultiplier: number;
  progressionStep: number;
}

/**
 * Genera la estructura de microciclos de un mesociclo según ciclo carga:descarga
 * configurado (3:1 o 4:1 desde AthleteThresholds.deloadRatio).
 *
 * NOTA DE EVIDENCIA: la duración de mesociclo (3-4 semanas) y el ratio 3:1/4:1
 * son convención de práctica extendida (TrainingPeaks/Intervals.icu), NO un
 * óptimo validado por ensayos controlados. La magnitud del deload (-40/50%
 * de volumen) es extrapolación del taper pre-competencia de Bosquet (2007),
 * aplicada por analogía a deload de mitad de temporada (evidencia indirecta).
 */
export function buildMesocycleWeeks(totalWeeks: number, deloadRatio: string): MicrocycleWeek[] {
  const [loadWeeksStr] = deloadRatio.split(":");
  const loadWeeks = parseInt(loadWeeksStr, 10) || 3;
  const cycleLength = loadWeeks + 1;

  const weeks: MicrocycleWeek[] = [];
  let progressionStep = 0;

  for (let i = 0; i < totalWeeks; i++) {
    const positionInCycle = i % cycleLength;
    const isDeload = positionInCycle === loadWeeks;

    weeks.push({
      weekNumber: i + 1,
      isDeload,
      loadMultiplier: isDeload ? 0.55 : 1.0,
      progressionStep: progressionStep,
    });

    if (!isDeload) progressionStep++;
    else progressionStep = 0;
  }

  return weeks;
}