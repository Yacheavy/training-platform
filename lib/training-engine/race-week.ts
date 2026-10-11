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

/**
 * Perfil de la prueba: define cómo es el ARRANQUE y el ritmo de la carrera, que es lo que el calentamiento y la activación preparan.
 * Es criterio propio apoyado en principios (no hay un estudio por perfil): un calentamiento ayuda sobre todo a los primeros minutos
 * del esfuerzo (Hajoglou 2005, Barranco-Gil 2020) y su intensidad/duración tiene que ajustarse a la exigencia del deporte (consenso 2026).
 */
export type CourseProfile = "llano" | "ondulado" | "montana" | "fondo" | "contrarreloj" | "criterium";
export const COURSE_PROFILES: { key: CourseProfile; label: string; desc: string }[] = [
  { key: "llano", label: "Llano, en pelotón", desc: "Ruta plana; se define en el pelotón o al sprint" },
  { key: "ondulado", label: "Ondulado (rompepiernas)", desc: "Subidas cortas y repetidas, cambios de ritmo" },
  { key: "montana", label: "Montaña (subida larga)", desc: "Una o varias subidas sostenidas, a ritmo de umbral" },
  { key: "fondo", label: "Fondo largo (más de 3 h)", desc: "Ritmo parejo y salida tranquila" },
  { key: "contrarreloj", label: "Contrarreloj", desc: "Esfuerzo individual a ritmo parejo" },
  { key: "criterium", label: "Criterium / circuito corto", desc: "Salida muy fuerte y muchos cambios de ritmo" },
];
export const normalizeCourseProfile = (v: unknown): CourseProfile | null =>
  COURSE_PROFILES.some((p) => p.key === v) ? (v as CourseProfile) : null;
export const courseProfileLabel = (v: string | null | undefined): string | null => COURSE_PROFILES.find((p) => p.key === v)?.label ?? null;

export interface RaceEvent {
  /** YYYY-MM-DD (fecha del evento). */
  dateKey: string;
  /** Solo A y B reciben tratamiento; C se entrena como una sesión más. */
  priority: string;
  name?: string;
  /** Perfil de la prueba (null o desconocido = genérico). */
  profile?: string | null;
}
export interface RaceContext {
  /** Días que faltan para el evento (0 = es hoy). */
  daysTo: number;
  priority: "A" | "B";
  name?: string;
  profile: CourseProfile | null;
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
      best = { daysTo: d, priority: e.priority, name: e.name, profile: normalizeCourseProfile(e.profile) };
    }
  }
  return best;
}

const wattsPct = (ftp: number, pct: number) => Math.round(ftp * pct);

/**
 * Activación de la víspera (~40 min): rodaje suave con pocas aperturas cortas, de la forma de los primeros minutos de la prueba.
 * Pocas, cortas y sin llegar al fallo: la idea es despertar las piernas, no entrenar. Criterio de práctica adaptado al perfil.
 */
export interface ActivationSpec { reps: { A: number; B: number }; sec: number; pct: number; recSec: number; what: string }
const GENERIC_ACTIVATION: ActivationSpec = { reps: { A: 3, B: 2 }, sec: 40, pct: 1.1, recSec: 150, what: "aperturas de 40″ a ritmo de carrera" };
export const ACTIVATION_SPECS: Record<CourseProfile, ActivationSpec> = {
  llano: GENERIC_ACTIVATION,
  fondo: { reps: { A: 2, B: 2 }, sec: 30, pct: 1.05, recSec: 150, what: "2 aperturas cortas y parejas de 30″ (la prueba es larga y de ritmo parejo)" },
  montana: { reps: { A: 3, B: 2 }, sec: 45, pct: 1.0, recSec: 180, what: "aperturas de 45″ a ritmo de subida (~FTP), sentado y con cadencia cómoda" },
  ondulado: { reps: { A: 3, B: 2 }, sec: 20, pct: 1.4, recSec: 150, what: "aperturas de 20″ fuertes, como la salida de una subida corta" },
  contrarreloj: { reps: { A: 2, B: 2 }, sec: 60, pct: 1.0, recSec: 180, what: "2 aperturas de 60″ al ritmo de la prueba, para sentir la potencia justa" },
  criterium: { reps: { A: 3, B: 3 }, sec: 20, pct: 1.5, recSec: 150, what: "aperturas explosivas de 20″, como las salidas de curva" },
};
export const activationSpec = (profile: CourseProfile | null): ActivationSpec => (profile ? ACTIVATION_SPECS[profile] : GENERIC_ACTIVATION);

export function buildActivationBlocks(ftp: number, priority: "A" | "B", totalMin = 40, profile: CourseProfile | null = null): WorkoutBlock[] {
  const sp = activationSpec(profile);
  const n = sp.reps[priority];
  const blocks: WorkoutBlock[] = [...buildWarmupZ2(600, ftp)];
  for (let i = 0; i < n; i++) {
    blocks.push({ type: "interval", durationSec: sp.sec, targetWatts: wattsPct(ftp, sp.pct) });
    blocks.push({ type: "recovery", durationSec: sp.recSec, targetWatts: wattsPct(ftp, 0.45) });
  }
  const cooldown = buildCooldown(300, ftp);
  const used = blocks.reduce((s, b) => s + b.durationSec, 0) + cooldown.reduce((s, b) => s + b.durationSec, 0);
  const fill = totalMin * 60 - used;
  if (fill > 60) blocks.push({ type: "z2_fill", durationSec: fill, targetWatts: wattsPct(ftp, 0.62) });
  blocks.push(...cooldown);
  return blocks;
}

/**
 * Calentamiento del día de la carrera, según el perfil. Se arma como [tipo, segundos, %FTP]:
 *  - genérico / llano: 5′ suave + 8′ Z2 + 2 activaciones de 45″ (~115 %)  → ~20 min
 *  - fondo: corto (~16 min), una sola activación de 30″: en esfuerzos largos y parejos el calentamiento no cambió el resultado
 *  - montaña: 2 bloques de 1′ cerca del umbral (la subida arranca a ritmo sostenido; un calentamiento fuerte no rindió más que uno suave) → ~20 min
 *  - ondulado: 3 activaciones de 30″ (~130 %) para los cambios de ritmo → ~20 min
 *  - contrarreloj: 3′ al ritmo de la prueba + 1′ un poco arriba, sin sprints para no salir pasado → ~23 min
 *  - criterium: 3 activaciones de 30″ (~130 %), un sprint de 8″ y 4′ suaves para recuperar antes de largar → ~21 min
 */
type Step = [type: string, sec: number, pct: number];
const WARMUP_STEPS: Record<CourseProfile | "generic", Step[]> = {
  generic: [["warmup_z1", 300, 0.5], ["warmup_z2", 480, 0.65], ["warmup_activation", 45, 1.15], ["warmup_recovery", 120, 0.5], ["warmup_activation", 45, 1.15], ["warmup_recovery", 180, 0.5]],
  llano: [["warmup_z1", 300, 0.5], ["warmup_z2", 480, 0.65], ["warmup_activation", 45, 1.15], ["warmup_recovery", 120, 0.5], ["warmup_activation", 45, 1.15], ["warmup_recovery", 180, 0.5]],
  fondo: [["warmup_z1", 300, 0.5], ["warmup_z2", 480, 0.65], ["warmup_activation", 30, 1.05], ["warmup_recovery", 150, 0.5]],
  montana: [["warmup_z1", 300, 0.5], ["warmup_z2", 480, 0.65], ["warmup_activation", 60, 1.0], ["warmup_recovery", 120, 0.5], ["warmup_activation", 60, 1.05], ["warmup_recovery", 180, 0.5]],
  ondulado: [["warmup_z1", 300, 0.5], ["warmup_z2", 480, 0.65], ["warmup_activation", 30, 1.3], ["warmup_recovery", 90, 0.5], ["warmup_activation", 30, 1.3], ["warmup_recovery", 90, 0.5], ["warmup_activation", 30, 1.3], ["warmup_recovery", 150, 0.5]],
  contrarreloj: [["warmup_z1", 300, 0.5], ["warmup_z2", 480, 0.65], ["warmup_activation", 180, 1.0], ["warmup_recovery", 180, 0.5], ["warmup_activation", 60, 1.05], ["warmup_recovery", 180, 0.5]],
  criterium: [["warmup_z1", 300, 0.5], ["warmup_z2", 360, 0.65], ["warmup_activation", 30, 1.3], ["warmup_recovery", 90, 0.5], ["warmup_activation", 30, 1.3], ["warmup_recovery", 90, 0.5], ["warmup_activation", 30, 1.3], ["warmup_recovery", 90, 0.5], ["warmup_activation", 8, 2.0], ["warmup_recovery", 240, 0.5]],
};
export function buildRaceWarmupBlocks(ftp: number, profile: CourseProfile | null = null): WorkoutBlock[] {
  return WARMUP_STEPS[profile ?? "generic"].map(([type, sec, pct]) => ({ type, durationSec: sec, targetWatts: wattsPct(ftp, pct) }));
}

const who = (r: RaceContext) => `carrera ${r.priority}${r.name ? ` «${r.name}»` : ""}`;
const plabel = (r: RaceContext) => courseProfileLabel(r.profile);

export function activationRationale(r: RaceContext): string {
  const sp = activationSpec(r.profile);
  const n = sp.reps[r.priority];
  const label = plabel(r);
  return (
    `Víspera de tu ${who(r)}${label ? ` (${label})` : ""}: activación corta (~40 min) con ${n} ${sp.what} y recuperación larga. ` +
    `Es práctica habitual de los entrenadores para llegar con las piernas despiertas${label ? "; la forma de las aperturas sigue el arranque de este tipo de prueba (criterio propio, sin estudio por perfil)" : ""}. ` +
    `No hay evidencia sólida de que mejore el resultado (el único estudio que encontré, una tesis con 8 ciclistas, no halló diferencia en una contrarreloj 24 h después). ` +
    `Si te sentís cargado, hacé solo el rodaje y salteá las aperturas.`
  );
}

const WARMUP_WHY: Record<CourseProfile | "generic", string> = {
  generic: "Calentamiento de ~20 min con dos activaciones de 45″. Un calentamiento ayuda sobre todo al arranque del esfuerzo; en esfuerzos largos y parejos no se demostró un beneficio sobre el resultado final.",
  llano: "Calentamiento de ~20 min con dos activaciones de 45″ para estar listo si el pelotón sale rápido o hay un ataque temprano. Ayuda sobre todo al arranque: en esfuerzos largos y parejos no se demostró beneficio sobre el resultado final.",
  fondo: "Prueba larga y de ritmo parejo: calentamiento corto (~16 min) con una sola activación. En contrarrelojes de 5 km y de 20 min el calentamiento no cambió el resultado global, así que no vale la pena gastar piernas; lo importante es salir tranquilo.",
  montana: "La subida exige ritmo sostenido casi desde el arranque: ~20 min que terminan con dos bloques de 1′ cerca del umbral (no por encima). En un esfuerzo de 3 km un calentamiento intenso no rindió más que uno suave, y no hay estudios en subidas largas: es criterio propio.",
  ondulado: "Rompepiernas, con cambios de ritmo desde temprano: ~20 min con tres activaciones de 30″ fuertes para que las piernas respondan a la primera subida corta. No hay estudio por perfil; es criterio propio.",
  contrarreloj: "Esfuerzo individual a ritmo parejo: ~23 min progresivos con 3′ al ritmo de la prueba y 1′ un poco arriba, sin sprints para no salir pasado. En una contrarreloj de 3 km el calentamiento aumentó la potencia de los primeros 1000 m; en 5 km y en 20 min no cambió el resultado global.",
  criterium: "Salida muy fuerte y cambios de ritmo: ~21 min con tres activaciones de 30″, un sprint corto de 8″ y 4′ suaves al final para recuperar antes de largar. Un calentamiento muy intenso o sin recuperación puede perjudicar los esfuerzos de menos de 10 s (Bishop 2003); en 30 s máximos un calentamiento activo rindió más que uno pasivo (congreso ECSS 2014, 9 ciclistas).",
};
export function raceWarmupRationale(r: RaceContext): string {
  const label = plabel(r);
  return (
    `Día de tu ${who(r)}${label ? ` (${label})` : ""}: ${WARMUP_WHY[r.profile ?? "generic"]} ` +
    `Terminalo unos 10–15 min antes de la largada (el tiempo exacto es práctica, sin estudio)` +
    `${r.profile === "fondo" ? "" : ". Si la prueba es muy larga (más de 3 h), hacé solo hasta la primera activación y cuidá las piernas"}.`
  );
}

export function miniTaperRationale(r: RaceContext): string {
  return (
    `MINI-TAPER pre-carrera (${who(r)}, faltan ${r.daysTo} días): volumen ~30 % menor y sin gimnasio pesado en los últimos días. ` +
    `Criterio de práctica: el taper con respaldo (Bosquet 2007) es el de ~2 semanas de las carreras A.`
  );
}

/** Qué cambia hoy por una carrera A/B cercana (lo usa la sugerencia "generar la sesión de hoy" cuando no hay plan). */
export type RaceAdjust =
  | { kind: "warmup" }
  | { kind: "activation"; optional: boolean }
  | { kind: "no_gym" }
  | { kind: "easy"; maxMin: number }
  | { kind: "taper"; mult: number };

export function raceAdjust(race: RaceContext | null, slotType: string | null | undefined): RaceAdjust | null {
  if (!race) return null;
  if (race.daysTo <= 0) return { kind: "warmup" };
  if (race.daysTo === 1) return { kind: "activation", optional: !slotType || slotType === "rest" };
  if (slotType === "gym" && race.daysTo <= gymFreeDays(race.priority)) return { kind: "no_gym" };
  if (slotType !== "cycling") return null;
  if (race.daysTo <= NO_QUALITY_DAYS) return { kind: "easy", maxMin: RACE_EASY_MAX_MIN };
  if (race.daysTo <= MINI_TAPER_DAYS) return { kind: "taper", mult: MINI_TAPER_MULT };
  return null;
}
