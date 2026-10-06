import { WorkoutBlock } from "./tss";

const PREFIX: Record<string, string> = {
  z2: "Z2",
  sweet_spot: "SS",
  umbral: "UMB",
  hiit_genuino: "HIIT",
  ronnestad_30_15: "30/15",
  z2_sprints: "Z2+SPR",
  billat_30_30: "30/30",
  rst: "RST",
  gym: "GYM",
};

function formatTime(sec: number): string {
  if (sec >= 60 && sec % 60 === 0) return `${sec / 60}'`;
  if (sec >= 60) return `${Math.floor(sec / 60)}'${sec % 60}"`;
  return `${sec}"`;
}

/**
 * Zona aproximada según %FTP, siguiendo los cortes estándar de Intervals.icu
 * (Z1<55, Z2 55-75, Z3 76-87, SS 88-94, Z4 95-105, Z5 106-120, Z6 121-150, Z7>150)
 */
function pctToZone(pct: number): string {
  if (pct < 55) return "Z1";
  if (pct < 76) return "Z2";
  if (pct < 88) return "Z3";
  if (pct <= 94) return "SS";
  if (pct <= 105) return "Z4";
  if (pct <= 120) return "Z5";
  if (pct <= 150) return "Z6";
  return "Z7";
}

/**
 * Convención: [Prefijo] [Reps]x[Esfuerzo]/[Descanso] [Zona]
 * Símbolos: x=repeticiones, '=minutos, "=segundos, /=separa esfuerzo/descanso, Z[N]=zona
 */
export function buildWorkoutName(
  stimulusType: string,
  blocks: WorkoutBlock[],
  ftp: number
): string {
  const prefix = PREFIX[stimulusType] ?? stimulusType.toUpperCase();
  if (stimulusType === "ftp_test" || stimulusType === "ftp_test_8min" || stimulusType === "ftp_test_5min") { return "TEST FTP"; }

  if (stimulusType === "gym" || stimulusType === "z2") {
    const totalMin = Math.round(blocks.reduce((s, b) => s + b.durationSec, 0) / 60);
    return `${prefix} ${totalMin}'`;
  }

  const intervals = blocks.filter((b) => b.type === "interval");
  const recoveries = blocks.filter((b) => b.type === "recovery");

  if (intervals.length === 0) return `${prefix} (generado)`;

  const reps = intervals.length;
  const intervalPct = Math.round((intervals[0].targetWatts / ftp) * 100);
  const zone = pctToZone(intervalPct);
  const effortStr = formatTime(intervals[0].durationSec);
  const restStr = recoveries.length > 0 ? formatTime(recoveries[0].durationSec) : null;

  const core = restStr ? `${reps}x${effortStr}/${restStr}` : `${reps}x${effortStr}`;
  return `${prefix} ${core} ${zone}`;
}
