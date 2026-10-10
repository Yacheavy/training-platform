import type { WorkoutBlock } from "./tss";
import { buildWarmupZ2, buildCooldown } from "./block-builder";

/**
 * Semana previa a una carrera (A o B): protección de los últimos días, activación la víspera y calentamiento del día.
 *
 * NOTA DE EVIDENCIA (leer antes de tocar los números):
 *  - Lo que SÍ tiene respaldo: el taper de ~2 semanas con el volumen −41 a −60 % y la intensidad y frecuencia conservadas
 *    (Bosquet 2007; Wang et al. 2023). Eso lo hace el bloque "tapering" de la temporada (solo carreras A con margen).
 *  - Lo que NO tiene estudio propio y es criterio de práctica: la forma de los últimos 4 días (mini-taper de −30 %, sin gimnasio
 *    los últimos días, sin calidad 48–72 h antes), la sesión de activación de la víspera y el momento del calentamiento.
 *    El único trabajo hallado sobre intervalos 24 h antes de una contrarreloj (tesis, 8 ciclistas) no halló efecto: la activación
 *    se presenta como práctica habitual y no como un beneficio demostrado.
 *  - Calentamiento: Fradkin 2010 (general), Barranco-Gil 2020 (20 min), Brock 2018 (4 km), consenso Delphi 2026 (Boullosa):
 *    ayuda sobre todo al inicio del esfuerzo; en esfuerzos largos y constantes no se demostró beneficio sobre el resultado.
 */

export const ACTIVATION_KEY = "activacion";
export const RACE_WARMUP_KEY = "calentamiento_carrera";
export const RACE_KEYS = [ACTIVATION_KEY, RACE_WARMUP_KEY];

export interface RaceEvent {
  /** YYYY-MM-DD (fecha del evento). */
  dateKey: string;
  /** Solo A y B reciben tratamiento; C se entrena como una sesión más. */
  priority: string;
  name?: string;
}
export interface RaceContext {
  /** Días que faltan para el evento (0 = es hoy). */
  daysTo: number;
  priority: "A" | "B";
  name?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Días previos a la carrera con volumen reducido (mini-taper). */
export const MINI_TAPER_DAYS = 4;
export const MINI_TAPER_MULT = 0.7;
/** Sin sesiones de calidad a 2 y 3 días de la carrera. */
export const NO_QUALITY_DAYS = 3;
/** Ventana de días previos sin gimnasio (A: 4, B: 3). */
export const gymFreeDays = (priority: "A" | "B"): number => (priority === "A" ? 4 : 3);
/** Tope del rodaje suave a 2–3 días de la carrera (criterio de práctica). */
export const RACE_EASY_MAX_MIN = 75;
/** La app no programa tests de FTP en la semana de una carrera. */
export const RACE_WEEK_DAYS = 7;

const keyMs = (k: string) => new Date(k + "T00:00:00Z").getTime();
export const daysBetween = (fromKey: string, toKey: string) => Math.round((keyMs(toKey) - keyMs(fromKey)) / DAY_MS);

/** Evento A/B más cercano que todavía no pasó (o es hoy) dentro de los próximos `RACE_WEEK_DAYS` días. Ante empate, gana la A. */
export function raceContext(dayKey: string, events: RaceEvent[]): RaceContext | null {
  let best: RaceContext | null = null;
  for (const e of events) {
    if (e.priority !== "A" && e.priority !== "B") continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.dateKey)) continue;
    const d = daysBetween(dayKey, e.dateKey);
    if (d < 0 || d > RACE_WEEK_DAYS) continue;
    if (!best || d < best.daysTo || (d === best.daysTo && e.priority === "A" && best.priority === "B")) {
      best = { daysTo: d, priority: e.priority, name: e.name };
    }
  }
  return best;
}

const wattsPct = (ftp: number, pct: number) => Math.round(ftp * pct);

/**
 * Activación de la víspera (~40 min): rodaje suave con 2 (B) o 3 (A) aperturas de 40 s a ritmo de carrera (~110 % FTP)
 * con recuperación larga. Pocas, cortas y sin llegar al fallo: la idea es despertar las piernas, no entrenar.
 */
export function buildActivationBlocks(ftp: number, priority: "A" | "B", totalMin = 40): WorkoutBlock[] {
  const n = priority === "A" ? 3 : 2;
  const blocks: WorkoutBlock[] = [...buildWarmupZ2(600, ftp)];
  for (let i = 0; i < n; i++) {
    blocks.push({ type: "interval", durationSec: 40, targetWatts: wattsPct(ftp, 1.1) });
    blocks.push({ type: "recovery", durationSec: 150, targetWatts: wattsPct(ftp, 0.45) });
  }
  const cooldown = buildCooldown(300, ftp);
  const used = blocks.reduce((s, b) => s + b.durationSec, 0) + cooldown.reduce((s, b) => s + b.durationSec, 0);
  const fill = totalMin * 60 - used;
  if (fill > 60) blocks.push({ type: "z2_fill", durationSec: fill, targetWatts: wattsPct(ftp, 0.62) });
  blocks.push(...cooldown);
  return blocks;
}

/**
 * Calentamiento del día de la carrera (~20 min): 5′ suave + 8′ Z2 + 2 activaciones de 45 s (~115 % FTP) con recuperación,
 * pensado para terminar unos 10–15 min antes de la largada. Para pruebas largas se corta en la primera activación.
 */
export function buildRaceWarmupBlocks(ftp: number): WorkoutBlock[] {
  return [
    { type: "warmup_z1", durationSec: 300, targetWatts: wattsPct(ftp, 0.5) },
    { type: "warmup_z2", durationSec: 480, targetWatts: wattsPct(ftp, 0.65) },
    { type: "warmup_activation", durationSec: 45, targetWatts: wattsPct(ftp, 1.15) },
    { type: "warmup_recovery", durationSec: 120, targetWatts: wattsPct(ftp, 0.5) },
    { type: "warmup_activation", durationSec: 45, targetWatts: wattsPct(ftp, 1.15) },
    { type: "warmup_recovery", durationSec: 180, targetWatts: wattsPct(ftp, 0.5) },
  ];
}

const who = (r: RaceContext) => `carrera ${r.priority}${r.name ? ` «${r.name}»` : ""}`;

export function activationRationale(r: RaceContext): string {
  const n = r.priority === "A" ? 3 : 2;
  return (
    `Víspera de tu ${who(r)}: activación corta (~40 min) con ${n} aperturas de 40″ a ritmo de carrera y recuperación larga. ` +
    `Es práctica habitual de los entrenadores para llegar con las piernas despiertas; no hay evidencia sólida de que mejore el resultado ` +
    `(el único estudio que encontré, una tesis con 8 ciclistas, no halló diferencia en una contrarreloj 24 h después). ` +
    `Si te sentís cargado, hacé solo el rodaje y salteá las aperturas.`
  );
}

export function raceWarmupRationale(r: RaceContext): string {
  return (
    `Día de tu ${who(r)}: calentamiento sugerido de ~20 min, para terminarlo unos 10–15 min antes de la largada (el tiempo exacto es práctica, sin estudio). ` +
    `Si la prueba es larga (más de 2 h), hacé solo hasta la primera activación y cuidá las piernas. ` +
    `Un calentamiento ayuda sobre todo al arranque del esfuerzo; en esfuerzos largos y parejos no se demostró un beneficio sobre el resultado final.`
  );
}

export function miniTaperRationale(r: RaceContext): string {
  return (
    `MINI-TAPER pre-carrera (${who(r)}, faltan ${r.daysTo} días): volumen ~30 % menor y sin gimnasio pesado en los últimos días. ` +
    `Criterio de práctica: el taper con respaldo (Bosquet 2007) es el de ~2 semanas de las carreras A.`
  );
}
