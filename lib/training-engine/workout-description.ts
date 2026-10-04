import { WorkoutBlock } from "./tss";

function formatDuration(sec: number): string {
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (remSec === 0) return `${min}m`;
  return `${min}m${remSec}s`;
}

function stepLine(b: WorkoutBlock, pct: (w: number) => string): string {
  return `- ${formatDuration(b.durationSec)} ${pct(b.targetWatts)}`;
}

/**
 * Detecta si mainBlocks es un patrón uniforme intervalo/recuperación
 * repetido N veces — en ese caso usa la notación compacta "Main Set Nx".
 * Si no es uniforme, cae al listado plano.
 */
function buildMainSetSection(mainBlocks: WorkoutBlock[], pct: (w: number) => string): string {
  const isPair = mainBlocks.length >= 4 && mainBlocks.length % 2 === 0;

  if (isPair) {
    const intervals = mainBlocks.filter((_, i) => i % 2 === 0);
    const recoveries = mainBlocks.filter((_, i) => i % 2 === 1);
    const sameInterval = intervals.every(
      (b) => b.durationSec === intervals[0].durationSec && b.targetWatts === intervals[0].targetWatts
    );
    const sameRecovery = recoveries.every(
      (b) => b.durationSec === recoveries[0].durationSec && b.targetWatts === recoveries[0].targetWatts
    );

    if (sameInterval && sameRecovery) {
      return `Main Set ${intervals.length}x\n${stepLine(intervals[0], pct)}\n${stepLine(recoveries[0], pct)}`;
    }
  }

  const lines = mainBlocks.map((b) => stepLine(b, pct));
  return `Main Set\n${lines.join("\n")}`;
}

export interface FuelingInfo {
  totalKj: number;
  suggestedCarbsG: number;
  suggestedCarbsGPerHour: number;
  requiresMultipleCarbSources: boolean;
}

/**
 * Arma la descripción completa del evento para Intervals.icu:
 * 1) Pasos estructurados reales (Warmup/Main Set/Cooldown) que el
 *    ciclocomputador puede leer y ejecutar.
 * 2) Una sección de Notas en texto libre (fueling + motivo de la
 *    sugerencia) — el parser de Intervals la ignora para el cálculo
 *    de pasos, pero queda visible como información para el atleta.
 */
export function buildStructuredWorkout(
  blocks: WorkoutBlock[],
  ftp: number,
  fueling?: FuelingInfo,
  rationale?: string | null
): string {
  const pct = (watts: number) => `${Math.round((watts / ftp) * 100)}%`;

  const warmupBlocks = blocks.filter((b) => b.type.startsWith("warmup"));
  const mainBlocks = blocks.filter((b) => b.type === "interval" || b.type === "recovery" || b.type === "z2" || b.type === "z2_fill" || b.type === "test_20min" || b.type === "test_8min" || b.type === "test_5min");
  const cooldownBlocks = blocks.filter((b) => b.type.startsWith("cooldown"));

  const sections: string[] = [];

  if (warmupBlocks.length > 0) {
    sections.push(`Warmup\n${warmupBlocks.map((b) => stepLine(b, pct)).join("\n")}`);
  }
  if (mainBlocks.length > 0) {
    sections.push(buildMainSetSection(mainBlocks, pct));
  }
  if (cooldownBlocks.length > 0) {
    sections.push(`Cooldown\n${cooldownBlocks.map((b) => stepLine(b, pct)).join("\n")}`);
  }

  const structuredPart = sections.join("\n\n");

  const notesLines: string[] = [];
  if (fueling) {
    notesLines.push(
      `Nutrición sugerida: ${fueling.suggestedCarbsG}g de carbohidratos (~${fueling.suggestedCarbsGPerHour}g/h), ${fueling.totalKj} kJ estimados.`
    );
    if (fueling.requiresMultipleCarbSources) {
      notesLines.push(
        `Atención: el ritmo de carbos supera el techo de una sola fuente — combiná glucosa + fructosa (ej. gel + bebida isotónica) para evitar malestar digestivo.`
      );
    }
  }
  if (rationale) {
    notesLines.push(`Motivo de la sugerencia: ${rationale}`);
  }

  const notesPart = notesLines.length > 0 ? `\n\nNotas\n${notesLines.join("\n")}` : "";

  return structuredPart + notesPart;
}
