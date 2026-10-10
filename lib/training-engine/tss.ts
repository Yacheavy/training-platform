export interface WorkoutBlock {
  type: string; // "warmup" | "interval" | "recovery" | "cooldown" | "z2"
  durationSec: number;
  targetWatts: number;
  /** Cadencia objetivo (rpm), opcional: solo la usan variantes con consigna de cadencia (p. ej. torque a baja cadencia). */
  cadenceRpm?: number;
  /** Detalle de una sesión de gimnasio o flexibilidad (solo bloques de tipo "gym"). */
  gym?: import("./strength").GymSession;
}

/**
 * TSS = (segundos × NP × IF) / (FTP × 3600) × 100
 * Para un workout con múltiples bloques a distinta potencia,
 * calculamos NP ponderado por el tiempo de cada bloque como aproximación,
 * ya que no tenemos el stream real segundo a segundo de un workout planeado.
 */
export function calculateTss(blocks: WorkoutBlock[], ftp: number): number {
  if (!blocks.length || !ftp) return 0;

  const totalDurationSec = blocks.reduce((sum, b) => sum + b.durationSec, 0);
  if (totalDurationSec === 0) return 0;

  // Potencia normalizada aproximada: promedio ponderado por tiempo,
  // dando más peso a los bloques de intensidad más alta (aproximación
  // simple de la naturaleza no-lineal de NP real)
  const weightedPowerSum = blocks.reduce(
    (sum, b) => sum + Math.pow(b.targetWatts, 4) * b.durationSec,
    0
  );
  const np = Math.pow(weightedPowerSum / totalDurationSec, 0.25);

  const intensityFactor = np / ftp;
  const tss = (totalDurationSec * np * intensityFactor) / (ftp * 3600) * 100;

  return Math.round(tss);
}

export function calculateKilojoules(blocks: WorkoutBlock[]): number {
  // kJ = potencia (W) × tiempo (s) / 1000, sumado por bloque
  const joules = blocks.reduce((sum, b) => sum + b.targetWatts * b.durationSec, 0);
  return Math.round(joules / 1000);
}