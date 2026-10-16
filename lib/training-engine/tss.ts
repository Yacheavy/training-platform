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
 * Potencia normalizada de un entrenamiento planeado, con la definición estándar (la misma que usa Intervals.icu):
 * promedio móvil de 30 s de la potencia, elevado a la cuarta, promediado, y raíz cuarta.
 * Los sprints o intervalos de menos de 30 s no pesan como si fueran sostenidos (antes se aproximaba por bloque y sobreestimaba
 * las sesiones de intervalos cortos entre un 10 y un 40 %). Para tramos de ≥ 30 s el resultado es el mismo que el promedio por bloque.
 */
export function normalizedPowerOf(blocks: WorkoutBlock[]): number {
  const total = blocks.reduce((s, b) => s + Math.max(0, Math.round(b.durationSec)), 0);
  if (total === 0) return 0;
  const pre = new Float64Array(total + 1);
  let k = 0;
  for (const b of blocks) {
    const n = Math.max(0, Math.round(b.durationSec));
    for (let i = 0; i < n; i++, k++) pre[k + 1] = pre[k] + b.targetWatts;
  }
  let sum4 = 0;
  for (let i = 0; i < total; i++) {
    const lo = i >= 29 ? i - 29 : 0;
    const avg = (pre[i + 1] - pre[lo]) / (i + 1 - lo);
    sum4 += avg * avg * avg * avg;
  }
  return Math.pow(sum4 / total, 0.25);
}

/**
 * TSS = (segundos × NP × IF) / (FTP × 3600) × 100, con NP calculada sobre la potencia objetivo segundo a segundo
 * (no tenemos el stream real de un entrenamiento planeado).
 */
export function calculateTss(blocks: WorkoutBlock[], ftp: number): number {
  if (!blocks.length || !ftp) return 0;

  const totalDurationSec = blocks.reduce((sum, b) => sum + b.durationSec, 0);
  if (totalDurationSec === 0) return 0;

  const np = normalizedPowerOf(blocks);
  const intensityFactor = np / ftp;
  const tss = (totalDurationSec * np * intensityFactor) / (ftp * 3600) * 100;

  return Math.round(tss);
}

export function calculateKilojoules(blocks: WorkoutBlock[]): number {
  // kJ = potencia (W) × tiempo (s) / 1000, sumado por bloque
  const joules = blocks.reduce((sum, b) => sum + b.targetWatts * b.durationSec, 0);
  return Math.round(joules / 1000);
}