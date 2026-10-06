import { WorkoutBlock } from "./tss";

function formatDuration(sec: number): string {
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min === 0) return `${remSec}s`;
  if (remSec === 0) return `${min}m`;
  return `${min}m${remSec}s`;
}

function stepLine(b: WorkoutBlock, pct: (w: number) => string): string {
  return `- ${formatDuration(b.durationSec)} ${pct(b.targetWatts)}`;
}

const same = (a: WorkoutBlock, b: WorkoutBlock) => a.durationSec === b.durationSec && a.targetWatts === b.targetWatts;

/**
 * Serie principal conservando el ORDEN de los bloques. Las tandas consecutivas e idénticas de
 * intervalo+recuperación se escriben con la notación de repetición de Intervals ("13x"), de modo
 * que se vea claramente cuántas repeticiones tiene cada serie; el resto (Z2, relleno, descansos
 * entre series) va como pasos sueltos.
 */
function buildMainSetSection(mainBlocks: WorkoutBlock[], pct: (w: number) => string): string {
  const sections: string[] = [];
  let loose: string[] = [];
  let setNo = 0;
  const flushLoose = () => {
    if (loose.length) sections.push(`${sections.length === 0 ? "Main Set" : "Pasos"}\n${loose.join("\n")}`);
    loose = [];
  };

  let i = 0;
  while (i < mainBlocks.length) {
    const iv = mainBlocks[i];
    const rc = mainBlocks[i + 1];
    if (iv.type === "interval" && rc && rc.type === "recovery") {
      let n = 1;
      while (
        mainBlocks[i + n * 2]?.type === "interval" && mainBlocks[i + n * 2 + 1]?.type === "recovery" &&
        same(mainBlocks[i + n * 2], iv) && same(mainBlocks[i + n * 2 + 1], rc)
      ) n++;
      flushLoose();
      setNo++;
      sections.push(`${setNo === 1 ? "Main Set" : `Serie ${setNo}`} ${n}x\n${stepLine(iv, pct)}\n${stepLine(rc, pct)}`);
      i += n * 2;
    } else {
      loose.push(stepLine(iv, pct));
      i++;
    }
  }
  flushLoose();
  return sections.join("\n\n");
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
  const reps = [...structuredPart.matchAll(/^(?:Main Set|Serie \d+) (\d+)x$/gm)].map((m) => Number(m[1]));
  if (reps.length > 0) {
    notesLines.push(`Estructura: ${reps.length === 1 ? "UNA sola serie" : `${reps.length} series`} — total ${reps.reduce((x, y) => x + y, 0)} repeticiones${reps.length > 1 ? ` (${reps.join(" + ")})` : ""}. No agregues series.`);
  }
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
