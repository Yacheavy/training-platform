/**
 * Sesiones de gimnasio y flexibilidad (módulo PURO, sin base de datos).
 *
 * Qué está respaldado y qué es práctica (honesto):
 *  - Fuerza PESADA (4-10 RM, 2-3 series, 2-3 min de pausa, 2 veces por semana en la preparación y ~1 de mantenimiento
 *    en temporada) es lo que mejor respalda la revisión de Rønnestad & Mujika 2014 [R57] para ciclistas.
 *  - Potencia/pliometría: evidencia LIMITADA en ciclistas [R57][R60]. Va en poca cantidad y se etiqueta como preliminar.
 *  - Core: beneficio marginal sobre el rendimiento [R61]. Complemento, no eje de la sesión.
 *  - Propiocepción: reduce lesiones en deportes en general [R58], no medido en ciclismo.
 *  - Flexibilidad: no previene lesiones [R58] ni mejora el rendimiento; estirar justo antes de rendir lo baja [R59].
 *    Por eso va al FINAL de la sesión y se presenta como práctica de comodidad y rango.
 *  - La carga se prescribe por repeticiones en reserva (RIR), no por % de 1RM: el alumno no tiene un 1RM medido.
 *    Subir la carga cuando completa todas las series en el tope del rango es un criterio práctico, no un protocolo validado.
 *  - Contraste (opcional, apagado por defecto): par pesado + explosivo (tradicional) o los 4 ejercicios de Cometti (francés).
 *    Evidencia CORTA y de otros deportes (saltos, bádminton), sin estudios en ciclistas [R62][R63]; el efecto de potenciación
 *    es pequeño y variable entre personas [R64][R65]. Solo en la sesión de potencia de umbral/VO2max.
 *  - Los patrones por fase y la elección de ejercicios son criterio propio sobre esa base.
 */
import type { WorkoutBlock } from "./tss";

export type ExCategory = "fuerza" | "potencia" | "core" | "propiocepcion";
export type GymRole = "fuerza" | "mantenimiento" | "potencia" | "estabilidad" | "movilidad";

/** Superserie: los ejercicios de un mismo grupo se hacen seguidos y se repiten por rondas (sets = rondas). */
export interface ExGroup {
  id: string;
  label: string;
  /** Posición dentro del grupo (1-based) y cantidad de ejercicios del grupo. */
  step: number;
  steps: number;
  /** Pausa entre ejercicios del grupo y pausa al terminar cada ronda, en segundos. */
  innerRestSec: number;
  roundRestSec: number;
}
export interface GymExercise {
  id: string;
  name: string;
  category: ExCategory;
  sets: number;
  reps: string;
  restSec: number;
  load: string;
  cue: string;
  group?: ExGroup;
}
export interface MobilityItem {
  name: string;
  hold: string;
  cue: string;
}
export interface GymSession {
  role: GymRole;
  /** Duración estimada de toda la sesión (entrada en calor + trabajo + flexibilidad), en segundos. */
  durationSec: number;
  title: string;
  summary: string;
  warmup: string[];
  exercises: GymExercise[];
  mobility: MobilityItem[];
  notes: string[];
  evidence: string[];
  refs: string[];
}

// ───────────────────────── catálogo ─────────────────────────
interface Ex { id: string; name: string; cue: string; perSide?: boolean }
type Pattern =
  | "squat" | "hinge" | "split" | "hipthrust" | "calf" | "push" | "pull"
  | "jump" | "ballistic" | "hop" | "loadedjump" | "assistedjump"
  | "plank" | "sideplank" | "antirot" | "deadbug"
  | "balance" | "glutestab" | "landing";

export const POOL: Record<Pattern, Ex[]> = {
  squat: [
    { id: "goblet", name: "Sentadilla goblet con mancuerna o kettlebell", cue: "Pecho alto, rodillas siguiendo la línea de los pies, bajá hasta donde mantengas la espalda neutra." },
    { id: "sentadilla_barra", name: "Sentadilla con barra", cue: "Barra estable, tronco firme, subí empujando el piso. Técnica primero; si es nueva, empezá liviano." },
    { id: "prensa", name: "Prensa de piernas", cue: "Pies a la altura de los hombros, rango cómodo sin despegar la cadera del respaldo." },
  ],
  hinge: [
    { id: "pm_rumano", name: "Peso muerto rumano con mancuernas o barra", cue: "Cadera hacia atrás, espalda neutra, barra cerca de las piernas; sentí los isquios, no la espalda baja." },
    { id: "buenos_dias", name: "Buenos días con barra liviana", cue: "Bisagra de cadera con rodillas ligeramente flexionadas; carga baja, control total." },
    { id: "pm_unipodal", name: "Peso muerto rumano a una pierna", cue: "Cadera cuadrada, pierna libre atrás como contrapeso; usá apoyo si perdés el equilibrio.", perSide: true },
  ],
  split: [
    { id: "bulgara", name: "Sentadilla búlgara", cue: "Pie trasero apoyado en un banco; rodilla delantera sobre el pie, tronco levemente inclinado.", perSide: true },
    { id: "estocada", name: "Estocada caminando o fija", cue: "Paso largo, rodilla delantera estable, bajá controlado.", perSide: true },
    { id: "step_up", name: "Subida al cajón (step-up)", cue: "Cajón a la altura de la rodilla; empujá con la pierna de arriba, sin impulso de la de abajo.", perSide: true },
  ],
  hipthrust: [
    { id: "puente_gluteo", name: "Puente de glúteos con peso (hip thrust)", cue: "Mentón recogido, costillas abajo, extendé la cadera sin arquear la espalda baja." },
  ],
  calf: [
    { id: "gemelos", name: "Elevación de talones (gemelos), de pie o sentado", cue: "Rango completo y pausa de 1 s arriba." },
  ],
  push: [
    { id: "flexiones", name: "Flexiones de brazos o press con mancuernas", cue: "Cuerpo en bloque, escápulas estables." },
  ],
  pull: [
    { id: "remo", name: "Remo con mancuerna o en polea", cue: "Tirá con la espalda, no con el brazo; hombros lejos de las orejas." },
    { id: "jalon", name: "Jalón al pecho o dominadas asistidas", cue: "Pecho al frente, codos hacia los bolsillos." },
  ],
  jump: [
    { id: "cmj", name: "Salto vertical (contramovimiento)", cue: "Bajá rápido, saltá lo más alto que puedas, aterrizá en silencio con las rodillas flexionadas." },
    { id: "salto_cajon", name: "Salto al cajón bajo", cue: "Cajón bajo; aterrizá firme sobre el cajón y bajá caminando (no saltando)." },
  ],
  ballistic: [
    { id: "swing_kb", name: "Swing con kettlebell", cue: "La potencia viene de la cadera, no de los brazos; brazos como cuerdas." },
    { id: "slam", name: "Lanzamiento de balón medicinal al piso (slam)", cue: "Tronco firme, descargá toda la fuerza en el lanzamiento." },
  ],
  loadedjump: [
    { id: "salto_cargado", name: "Salto vertical con carga liviana", cue: "Mancuernas o chaleco con un 10-30 % de lo que usás en la sentadilla. Salto máximo y aterrizaje suave con las rodillas flexionadas." },
  ],
  assistedjump: [
    { id: "salto_asistido", name: "Salto asistido con banda", cue: "Banda elástica fija arriba que te ayuda a despegar: saltá lo más rápido y alto posible y aterrizá suave." },
  ],
  hop: [
    { id: "patinador", name: "Salto lateral de patinador", cue: "Salto lateral largo y aterrizaje estable sobre una pierna, mantenelo 1-2 s.", perSide: true },
    { id: "salto_unipodal", name: "Salto unipodal hacia adelante con aterrizaje estable", cue: "Salto corto, aterrizaje controlado, rodilla alineada con el pie.", perSide: true },
  ],
  plank: [
    { id: "plancha", name: "Plancha frontal", cue: "Cuerpo en línea, glúteos y abdomen firmes, respirá sin soltar." },
    { id: "hollow", name: "Hollow hold (abdominal \"bote\")", cue: "Zona lumbar pegada al piso; si se despega, recogé las piernas." },
  ],
  sideplank: [
    { id: "plancha_lat", name: "Plancha lateral", cue: "Cadera elevada, cuerpo recto de los pies a la cabeza.", perSide: true },
  ],
  antirot: [
    { id: "pallof", name: "Press Pallof (anti-rotación) con banda o polea", cue: "El tronco no rota: estirá los brazos y volvé sin dejar que la banda te gire.", perSide: true },
    { id: "carry", name: "Caminata con peso en una mano (maleta)", cue: "Tronco derecho, hombros nivelados, pasos cortos y firmes.", perSide: true },
  ],
  deadbug: [
    { id: "dead_bug", name: "Dead bug", cue: "Zona lumbar pegada al piso; extendé brazo y pierna contrarios lento.", perSide: true },
    { id: "bird_dog", name: "Bird dog", cue: "Cadera cuadrada, extendé brazo y pierna contrarios sin rotar.", perSide: true },
  ],
  balance: [
    { id: "apoyo_unipodal", name: "Apoyo a una pierna (de a poco: ojos cerrados o sobre una almohadilla)", cue: "Rodilla suave y alineada. Progresá solo si el ejercicio anterior sale firme.", perSide: true },
    { id: "alcance_y", name: "Apoyo a una pierna con alcances (estrella)", cue: "Tocá con el pie libre en tres direcciones sin perder el equilibrio.", perSide: true },
  ],
  glutestab: [
    { id: "banda_lateral", name: "Caminata lateral con banda", cue: "Pasos cortos, rodillas hacia afuera, tensión constante en la banda.", perSide: true },
    { id: "clamshell", name: "Almeja con banda (clamshell)", cue: "Cadera estable, sin rotar el tronco al abrir.", perSide: true },
  ],
  landing: [
    { id: "bajada_cajon", name: "Bajada controlada del cajón a una pierna", cue: "Bajá lento y mantenete firme en el apoyo; la rodilla no cae hacia adentro.", perSide: true },
  ],
};

const pickEx = (p: Pattern, seed: number): Ex => POOL[p][Math.abs(seed) % POOL[p].length];

// ───────────────────────── prescripción ─────────────────────────
interface Rx { sets: number; reps: string; restSec: number; load: string }

const ROLE_TITLE: Record<GymRole, string> = {
  fuerza: "Fuerza de piernas y tronco",
  mantenimiento: "Fuerza de mantenimiento (pesado, poco volumen)",
  potencia: "Potencia y estabilidad",
  estabilidad: "Estabilidad, core y propiocepción",
  movilidad: "Flexibilidad y movilidad",
};

const CAT_WORK_SEC: Record<ExCategory, number> = { fuerza: 45, potencia: 20, core: 40, propiocepcion: 45 };

function heavyRx(role: GymRole, pos: number, deload: boolean, reentry: boolean, nextDayHard: boolean): Rx {
  const basePhase = role === "fuerza";
  let rir = deload ? 4 : reentry ? 4 : [3, 2, 1][Math.min(pos, 2)];
  if (nextDayHard) rir = Math.max(rir, 3);
  let sets = basePhase ? (pos === 0 ? 2 : 3) : (pos <= 1 ? 2 : 3);
  if (reentry) sets = 2;
  if (deload) sets = Math.max(1, sets - 1);
  const reps = basePhase ? "6-8" : "4-6";
  return {
    sets,
    reps,
    restSec: 150,
    load: `Carga con la que te queden ${rir} repeticiones en reserva (RIR ${rir}). Levantá lo más rápido que puedas en la subida, bajá controlado. Subí 2,5-5 % la carga cuando completes todas las series en el tope del rango con buena técnica.`,
  };
}
const accessoryRx = (sets: number, reps: string, loadHint = "Carga moderada, 2-3 repeticiones en reserva."): Rx => ({ sets, reps, restSec: 75, load: loadHint });
const coreRx = (reps: string, sets = 2): Rx => ({ sets, reps, restSec: 45, load: "Calidad antes que tiempo: cortá la serie cuando se pierda la postura." });
const propioRx = (reps: string, sets = 2): Rx => ({ sets, reps, restSec: 30, load: "Controlado y sin apuro. Progresá (ojos cerrados, superficie blanda) solo cuando salga firme." });
const powerRx = (sets: number, reps: string): Rx => ({ sets, reps, restSec: 75, load: "Cada repetición a máxima velocidad, con pausa completa entre series. Cortá si perdés altura o técnica." });

function timeOf(e: GymExercise, perSide: boolean): number {
  const work = CAT_WORK_SEC[e.category] * (perSide ? 2 : 1);
  return e.sets * (work + e.restSec);
}


// ───────────────────────── contraste ─────────────────────────
export type ContrastMode = "tradicional" | "frances";
const GROUP_WORK_SEC = 20; // 3 repeticiones
const exById = (id: string): Ex => Object.values(POOL).flat().find((e) => e.id === id)!;
const HEAVY_SQUAT = ["sentadilla_barra", "prensa"];

interface GroupSpec { id: string; label: string; items: { ex: Ex; cat: ExCategory; reps: string; load: string }[]; innerRestSec: number; roundRestSec: number; rounds: number }

const HEAVY_LOAD = "Carga pesada con 3 repeticiones en reserva (RIR 3): lejos del fallo. Subí lo más rápido que puedas y bajá controlado.";
const EXPLOSIVE_LOAD = "Máxima velocidad desde la primera repetición. Cortá la ronda si perdés altura o técnica.";

/** Arma un grupo (superserie) como ejercicios con `group`; devuelve el tiempo que lleva en segundos. */
function groupExercises(g: GroupSpec): { list: GymExercise[]; sec: number } {
  const list: GymExercise[] = g.items.map((it, n) => ({
    id: it.ex.id, name: it.ex.name, category: it.cat, sets: g.rounds, reps: it.reps,
    restSec: n === g.items.length - 1 ? g.roundRestSec : g.innerRestSec,
    load: it.load, cue: it.ex.cue,
    group: { id: g.id, label: g.label, step: n + 1, steps: g.items.length, innerRestSec: g.innerRestSec, roundRestSec: g.roundRestSec },
  }));
  const roundSec = g.items.length * GROUP_WORK_SEC + (g.items.length - 1) * g.innerRestSec + g.roundRestSec;
  return { list, sec: g.rounds * roundSec };
}
const roundSecOf = (items: number, inner: number, round: number) => items * GROUP_WORK_SEC + (items - 1) * inner + round;

/** Superseries de contraste que entran en el tiempo disponible; vacío si no entra al menos una de 2 rondas. */
function buildContrast(mode: ContrastMode, seed: number, pos: number, budgetSec: number): { groups: { list: GymExercise[]; sec: number }[]; contacts: number } {
  const heavySquat = exById(HEAVY_SQUAT[Math.abs(seed) % HEAVY_SQUAT.length]);
  const jump = pickEx("jump", seed);
  const out: { list: GymExercise[]; sec: number }[] = [];
  let left = budgetSec;
  let contacts = 0;
  const fit = (target: number, items: number, inner: number, round: number) => Math.min(target, Math.floor(left / roundSecOf(items, inner, round)));
  if (mode === "frances") {
    const inner = 20, round = 240;
    const rounds = fit([3, 4, 4][Math.min(pos, 2)], 4, inner, round);
    if (rounds >= 2) {
      const g = groupExercises({
        id: "A", label: "Contraste francés", innerRestSec: inner, roundRestSec: round, rounds,
        items: [
          { ex: heavySquat, cat: "fuerza", reps: "3", load: HEAVY_LOAD },
          { ex: jump, cat: "potencia", reps: "3", load: EXPLOSIVE_LOAD },
          { ex: exById("salto_cargado"), cat: "potencia", reps: "3", load: EXPLOSIVE_LOAD },
          { ex: exById("salto_asistido"), cat: "potencia", reps: "3", load: EXPLOSIVE_LOAD },
        ],
      });
      out.push(g); left -= g.sec; contacts += rounds * 9;
    }
  } else {
    const inner = 20, round = 210;
    const target = [3, 3, 4][Math.min(pos, 2)];
    const rA = fit(target, 2, inner, round);
    if (rA >= 2) {
      const a = groupExercises({ id: "A", label: "Contraste tradicional (sentadilla + salto)", innerRestSec: inner, roundRestSec: round, rounds: rA,
        items: [{ ex: heavySquat, cat: "fuerza", reps: "3", load: HEAVY_LOAD }, { ex: jump, cat: "potencia", reps: "3", load: EXPLOSIVE_LOAD }] });
      out.push(a); left -= a.sec; contacts += rA * 3;
      const rB = fit(target, 2, inner, round);
      if (rB >= 2) {
        const b = groupExercises({ id: "B", label: "Contraste tradicional (bisagra + swing)", innerRestSec: inner, roundRestSec: round, rounds: rB,
          items: [{ ex: exById("pm_rumano"), cat: "fuerza", reps: "3", load: HEAVY_LOAD }, { ex: exById("swing_kb"), cat: "potencia", reps: "5", load: EXPLOSIVE_LOAD }] });
        out.push(b); left -= b.sec;
      }
    }
  }
  return { groups: out, contacts };
}

// ───────────────────────── movilidad ─────────────────────────
const MOBILITY: (MobilityItem & { sec: number })[] = [
  { name: "Flexor de cadera en media rodilla", hold: "2 × 30-40 s por lado", cue: "Cadera hacia adelante con el glúteo firme; sin arquear la espalda baja.", sec: 160 },
  { name: "Isquiotibiales con pierna extendida", hold: "2 × 30 s por lado", cue: "Espalda larga, inclinate desde la cadera.", sec: 130 },
  { name: "Glúteo en \"figura 4\"", hold: "2 × 30 s por lado", cue: "Tobillo sobre la rodilla contraria; llevá el pecho hacia adelante con la espalda larga.", sec: 130 },
  { name: "Cuádriceps de pie", hold: "2 × 30 s por lado", cue: "Rodillas juntas, pelvis neutra.", sec: 130 },
  { name: "Gemelos contra la pared", hold: "2 × 30 s por lado", cue: "Talón apoyado, rodilla extendida.", sec: 130 },
  { name: "Rotación torácica en cuadrupedia", hold: "8 repeticiones por lado", cue: "Mano detrás de la cabeza, abrí el codo hacia el techo.", sec: 90 },
  { name: "Apertura de pecho en marco de puerta", hold: "2 × 30 s", cue: "Antebrazo apoyado, paso al frente; hombros lejos de las orejas.", sec: 80 },
  { name: "Gato-camello", hold: "8 repeticiones lentas", cue: "Movés toda la columna, respirando.", sec: 60 },
];

export function buildMobilitySet(minutes: number): MobilityItem[] {
  const out: MobilityItem[] = [];
  let used = 0;
  for (const m of MOBILITY) {
    if (used + m.sec > minutes * 60 + 20) continue;
    used += m.sec;
    out.push({ name: m.name, hold: m.hold, cue: m.cue });
  }
  return out;
}

const WARMUP_FULL = [
  "3-5 min suaves de bici fija, remo o caminata rápida hasta entrar en calor.",
  "Movilidad dinámica: círculos de cadera, balanceo de piernas adelante-atrás y de lado a lado (10 por pierna).",
  "Activación: puente de glúteos 1 × 12 y caminata lateral con banda 1 × 10 por lado.",
  "Primera serie del ejercicio principal con 50 % de la carga de trabajo.",
];
const WARMUP_SHORT = [
  "3 min suaves de bici fija o caminata rápida.",
  "Círculos de cadera y balanceo de piernas (10 por pierna) y puente de glúteos × 10.",
];

// ───────────────────────── armado de la sesión ─────────────────────────
export interface GymInput {
  /** Minutos del día (ya con el multiplicador de carga de la semana). */
  slotMin: number;
  /** base | umbral | vo2max | tapering */
  objective: string;
  weekIndex: number;
  cycleLength: number;
  isDeload: boolean;
  /** Últimas 2 semanas de un bloque de puesta a punto. */
  isTaperWeek: boolean;
  /** Posición (0, 1, …) de este día de gimnasio dentro de su semana. */
  gymIndexInWeek: number;
  gymCountInWeek: number;
  /** El día siguiente es de calidad o una salida larga. */
  nextDayHard: boolean;
  /** Minutos de flexibilidad al final (0 = desactivada). */
  mobilityMin: number;
  /** Entrenamiento de contraste: off (por defecto) | tradicional | frances. Solo actúa en la sesión de potencia. */
  contrast?: string | null;
}

export function chooseRole(i: GymInput): GymRole {
  const idx = i.gymIndexInWeek;
  if (i.isTaperWeek || i.isDeload) return idx === 0 ? "mantenimiento" : "estabilidad";
  if (i.objective === "base") return idx <= 1 ? "fuerza" : "estabilidad";
  if (i.objective === "tapering") return idx === 0 ? "mantenimiento" : "estabilidad";
  // umbral / vo2max
  if (idx === 0) return "mantenimiento";
  if (idx === 1) return "potencia";
  return "estabilidad";
}

export function buildGymSession(i: GymInput): GymSession {
  const role = chooseRole(i);
  const pos = i.weekIndex % i.cycleLength;
  const meso = Math.floor(i.weekIndex / i.cycleLength);
  const reentry = i.weekIndex === 0;
  const seed = meso + (i.gymIndexInWeek === 1 ? 1 : 0);
  const hard = (p: Pattern) => ({ p, rx: heavyRx(role, pos, i.isDeload, reentry, i.nextDayHard), cat: "fuerza" as const });

  type Cand = { p: Pattern; rx: Rx; cat: ExCategory; seedAdd?: number };
  const lighten = (r: Rx): Rx => ({ ...r, sets: Math.max(1, r.sets - (i.isDeload || i.isTaperWeek ? 1 : 0)) });
  const fuerzaA: Cand[] = [
    hard("squat"), hard("hinge"), hard("split"),
    { p: "calf", cat: "fuerza", rx: accessoryRx(2, "10-12") },
    { p: "pull", cat: "fuerza", rx: accessoryRx(2, "8-10") },
    { p: "antirot", cat: "core", rx: coreRx("8-10 por lado") },
    { p: "plank", cat: "core", rx: coreRx("30-45 s") },
    { p: "balance", cat: "propiocepcion", rx: propioRx("30-40 s por pierna") },
  ];
  const fuerzaB: Cand[] = [
    hard("hinge"), hard("squat"),
    { p: "hipthrust", cat: "fuerza", rx: accessoryRx(3, "8-10") },
    { p: "push", cat: "fuerza", rx: accessoryRx(2, "8-10") },
    { p: "pull", cat: "fuerza", rx: accessoryRx(2, "8-10"), seedAdd: 1 },
    { p: "sideplank", cat: "core", rx: coreRx("25-40 s por lado") },
    { p: "deadbug", cat: "core", rx: coreRx("8 por lado") },
    { p: "glutestab", cat: "propiocepcion", rx: propioRx("12 por lado") },
  ];
  const mantenimiento: Cand[] = [
    hard("squat"), hard("hinge"),
    { p: "pull", cat: "fuerza", rx: accessoryRx(2, "6-8") },
    { p: "push", cat: "fuerza", rx: accessoryRx(2, "6-8") },
    { p: "antirot", cat: "core", rx: coreRx("8 por lado") },
    { p: "plank", cat: "core", rx: coreRx("30-40 s") },
  ];
  const potencia: Cand[] = [
    { p: "jump", cat: "potencia", rx: powerRx(3, "4-5") },
    { p: "ballistic", cat: "potencia", rx: powerRx(3, "6-8") },
    { p: "split", cat: "fuerza", rx: heavyRx("mantenimiento", pos, i.isDeload, reentry, i.nextDayHard) },
    { p: "hop", cat: "potencia", rx: powerRx(2, "5 por lado") },
    { p: "balance", cat: "propiocepcion", rx: propioRx("30-40 s por pierna") },
    { p: "sideplank", cat: "core", rx: coreRx("25-40 s por lado") },
    { p: "antirot", cat: "core", rx: coreRx("8 por lado") },
  ];
  const estabilidad: Cand[] = [
    { p: "split", cat: "fuerza", rx: accessoryRx(2, "8-10 por pierna", "Carga liviana-moderada, sin llegar al límite: hoy se trabaja control.") },
    { p: "hipthrust", cat: "fuerza", rx: accessoryRx(2, "10-12", "Carga liviana-moderada, sin llegar al límite.") },
    { p: "balance", cat: "propiocepcion", rx: propioRx("30-40 s por pierna", 3) },
    { p: "glutestab", cat: "propiocepcion", rx: propioRx("12 por lado") },
    { p: "landing", cat: "propiocepcion", rx: propioRx("6 por pierna") },
    { p: "deadbug", cat: "core", rx: coreRx("8 por lado") },
    { p: "plank", cat: "core", rx: coreRx("30-45 s") },
    { p: "sideplank", cat: "core", rx: coreRx("25-40 s por lado") },
    { p: "pull", cat: "fuerza", rx: accessoryRx(2, "10-12", "Carga liviana, postura.") },
  ];
  const plan: Cand[] = role === "fuerza" ? (i.gymIndexInWeek === 0 ? fuerzaA : fuerzaB) : role === "mantenimiento" ? mantenimiento : role === "potencia" ? potencia : estabilidad;

  // Tiempo disponible: el slot menos entrada en calor y flexibilidad final
  const warmup = i.slotMin >= 60 ? WARMUP_FULL : WARMUP_SHORT;
  const warmupSec = (i.slotMin >= 60 ? 8 : 5) * 60;
  const mobilitySec = i.mobilityMin * 60;
  const budget = Math.max(0, i.slotMin * 60 - warmupSec - mobilitySec);

  const exercises: GymExercise[] = [];
  let used = 0;
  const addCand = (c: Cand, force = false): boolean => {
    const ex = pickEx(c.p, seed + (c.seedAdd ?? 0));
    const base = {
      id: ex.id, name: ex.name, category: c.cat, sets: c.rx.sets, reps: c.rx.reps, restSec: c.rx.restSec, load: c.rx.load, cue: ex.cue,
    } satisfies GymExercise;
    const e: GymExercise = c.cat === "fuerza" && (i.isDeload || i.isTaperWeek) && c.rx.restSec === 75 ? { ...base, sets: lighten(c.rx).sets } : base;
    const t = timeOf(e, !!ex.perSide);
    if (!force && used + t > budget) return false;
    exercises.push(e);
    used += t;
    return true;
  };
  // Contraste (opcional): reemplaza el bloque de saltos de la sesión de potencia cuando hay tiempo y no es la primera semana
  const mode: ContrastMode | null = i.contrast === "tradicional" || i.contrast === "frances" ? i.contrast : null;
  let contrastUsed: ContrastMode | null = null;
  if (mode && role === "potencia" && !reentry && !i.isDeload && !i.isTaperWeek) {
    const c = buildContrast(mode, seed, pos, budget);
    if (c.groups.length && c.contacts <= 60) {
      contrastUsed = mode;
      for (const g of c.groups) { exercises.push(...g.list); used += g.sec; }
    }
  }
  const finalPlan = contrastUsed ? plan.filter((c) => !["jump", "ballistic", "split", "hop"].includes(c.p)) : plan;
  for (const c of finalPlan) addCand(c);
  // Piso mínimo: al menos un ejercicio de fuerza y uno de core aunque el slot sea muy corto
  if (!exercises.some((e) => e.category === "fuerza" || e.category === "potencia") && finalPlan[0]) addCand(finalPlan[0], true);
  if (!exercises.some((e) => e.category === "core")) { const core = finalPlan.find((c) => c.cat === "core"); if (core) addCand(core, true); }

  // Si sobra tiempo (≥ 8 min), se completa con trabajo de tronco y control (liviano, sin sumar carga pesada)
  const filler: Cand[] = [
    { p: "deadbug", cat: "core", rx: coreRx("8 por lado") },
    { p: "glutestab", cat: "propiocepcion", rx: propioRx("12 por lado") },
    { p: "sideplank", cat: "core", rx: coreRx("25-40 s por lado") },
  ];
  for (const f of filler) {
    if (budget - used < 8 * 60) break;
    if (exercises.some((e) => e.id === pickEx(f.p, seed).id)) continue;
    addCand(f);
  }

  const mobility = i.mobilityMin > 0 ? buildMobilitySet(i.mobilityMin) : [];

  const refs = new Set<string>();
  const evidence: string[] = [];
  const has = (c: ExCategory) => exercises.some((e) => e.category === c);
  if (has("fuerza")) { refs.add("R57"); refs.add("R58"); evidence.push("Fuerza pesada en ciclistas: respaldada por una revisión (Rønnestad & Mujika 2014) [R57]. En deportes en general, la fuerza redujo las lesiones a menos de un tercio [R58], pero eso no se midió en ciclismo."); }
  if (has("potencia")) { refs.add("R57"); refs.add("R60"); evidence.push("Potencia/pliometría: evidencia LIMITADA en ciclistas; el trabajo explosivo con cargas bajas no mejoró el rendimiento en un estudio [R57] y hay un ensayo que lo combina con fuerza pesada [R60, solo verificada la cita]. Por eso va en poca cantidad."); }
  if (contrastUsed === "tradicional") {
    for (const r of ["R63", "R64", "R65"]) refs.add(r);
    evidence.push("Contraste tradicional (serie pesada y enseguida un salto del mismo patrón): se apoya en la potenciación post-activación, cuyo efecto es pequeño en el metaanálisis disponible (tamaño de efecto 0,31, 6 estudios, solo tren superior) [R64] y muy variable entre personas: en voleibolistas de élite no apareció en 4 sesiones [R65]. Un ensayo en bádminton usó este esquema como comparación [R63]. No encontré estudios en ciclistas: es una hipótesis razonable, no una práctica demostrada.");
  }
  if (contrastUsed === "frances") {
    for (const r of ["R62", "R63", "R64", "R65"]) refs.add(r);
    evidence.push("Contraste francés (Cometti: pesado, salto, salto con carga liviana y salto asistido): lo describe la NSCA y reconoce que la evidencia es corta (estudios de 6-8 semanas) [R62]. Un ensayo de 8 semanas con 20 bádmintonistas lo halló superior al entrenamiento complejo en salto y agilidad, pero con pocos sujetos y ejercicios distintos entre grupos [R63]. La potenciación en que se apoya es pequeña y variable [R64][R65]. No encontré estudios en ciclistas: es una hipótesis razonable, no una práctica demostrada.");
  }
  if (has("core")) { refs.add("R61"); evidence.push("Core: aporta beneficios marginales al rendimiento [R61]; es un complemento, no el eje de la sesión."); }
  if (has("propiocepcion")) { refs.add("R58"); evidence.push("Propiocepción: redujo lesiones en deportes en general [R58]; no se midió en ciclismo."); }
  if (mobility.length) { refs.add("R58"); refs.add("R59"); evidence.push("Flexibilidad: práctica de comodidad y rango de movimiento. No previene lesiones [R58] ni mejora el rendimiento, y estirar justo antes de rendir lo baja [R59]; por eso va al final."); }

  const phaseText: Record<GymRole, string> = {
    fuerza: "Fase de base: se construye fuerza máxima, que es cuando más conviene trabajarla.",
    mantenimiento: i.isDeload ? "Semana de descarga: menos series y más repeticiones en reserva." : i.isTaperWeek ? "Puesta a punto: se mantiene la intensidad y baja el volumen." : "Fase de intensidad: una sesión pesada por semana con poco volumen para mantener la fuerza sin robarle energía a la bici.",
    potencia: "Fase de intensidad: trabajo explosivo corto, con pausas completas y sin llegar a la fatiga.",
    estabilidad: "Sesión de control: trabajo liviano de estabilidad y tronco, para llegar fresco a la bici.",
    movilidad: "",
  };
  const notes: string[] = [];
  if (contrastUsed) {
    notes.push("El contraste exige técnica sólida en la sentadilla y los saltos y una base de fuerza de varios bloques [R62]. Si no la tenés, pedí que lo desactiven en Ajustes.");
    notes.push("Respetá las pausas: entre ejercicios son cortas (20 s) y entre rondas largas. Si bajás la altura del salto, terminá la sesión.");
  } else if (mode && role === "potencia" && reentry) {
    notes.push("Primera semana del bloque: se hace la sesión de potencia común; el contraste empieza la semana 2.");
  }
  if (reentry && (role === "fuerza" || role === "mantenimiento")) notes.push("Primera semana del bloque: 2 series y 4 repeticiones en reserva para reentrar con buena técnica.");
  if (i.nextDayHard && (role === "fuerza" || role === "mantenimiento")) notes.push("Mañana tenés una sesión de calidad o larga: hoy no llegues cerca del fallo (criterio práctico).");
  notes.push("Técnica primero. Si nunca levantaste con barra, empezá con cargas muy livianas o pedí que te corrijan el movimiento [R57].");
  notes.push("Dolor agudo o articular: cortá el ejercicio. La molestia muscular del día siguiente es normal; el dolor que no se va, no.");

  const totalSec = Math.round((warmupSec + used + mobilitySec) / 60) * 60;
  return {
    role,
    durationSec: totalSec,
    title: contrastUsed ? (contrastUsed === "frances" ? "Potencia: contraste francés" : "Potencia: contraste tradicional") : ROLE_TITLE[role],
    summary: contrastUsed ? "Fase de intensidad: superseries de contraste con volumen bajo y pausas largas entre rondas, para llegar fresco a la bici." : phaseText[role],
    warmup: [...warmup],
    exercises,
    mobility,
    notes,
    evidence,
    refs: [...refs].sort(),
    // durationSec va en el bloque; se expone por conveniencia en el resumen
  };
}

/** Día propio de flexibilidad: movilidad suave + set de estiramientos. */
export function buildFlexSession(slotMin: number): GymSession {
  const minutes = Math.max(10, Math.min(30, slotMin));
  const mob = buildMobilitySet(Math.max(8, minutes - 4));
  return {
    role: "movilidad",
    durationSec: minutes * 60,
    title: ROLE_TITLE.movilidad,
    summary: "Sesión suave de movilidad y estiramientos. Se hace aparte de la bici, sin intensidad.",
    warmup: ["2-3 min de caminata o bici muy suave para entrar en calor antes de estirar."],
    exercises: [],
    mobility: mob,
    notes: [
      "Estirá hasta una tensión cómoda, nunca dolor. Respirá lento y no rebotes.",
      "Evitá hacerlo justo antes de una sesión intensa: estirar antes de rendir baja el rendimiento [R59].",
    ],
    evidence: ["Flexibilidad: práctica de comodidad y rango de movimiento. No previene lesiones [R58] ni mejora el rendimiento; el efecto sobre el rango dura menos de 30 min [R59]."],
    refs: ["R58", "R59"],
  };
}

/** Texto plano de la sesión (Intervals y vista previa). */
export function gymToText(g: GymSession): string {
  const lines: string[] = [g.title];
  if (g.summary) lines.push(g.summary);
  if (g.warmup.length) lines.push("", "Entrada en calor", ...g.warmup.map((w) => `- ${w}`));
  const CAT: Record<ExCategory, string> = { fuerza: "Fuerza", potencia: "Potencia", core: "Core", propiocepcion: "Propiocepción" };
  if (g.exercises.length) {
    lines.push("", "Trabajo principal");
    g.exercises.forEach((e, n) => {
      if (e.group) {
        if (e.group.step === 1) lines.push(`Superserie ${e.group.id}: ${e.group.label} — ${e.sets} rondas, ${e.group.innerRestSec} s entre ejercicios y ${Math.round(e.group.roundRestSec / 60 * 2) / 2} min entre rondas`);
        lines.push(`${e.group.id}${e.group.step}. ${e.name} — ${e.reps} (${CAT[e.category]})\n   ${e.cue}\n   ${e.load}`);
      } else lines.push(`${n + 1}. ${e.name} — ${e.sets} × ${e.reps} (${CAT[e.category]}, pausa ${Math.round(e.restSec / 15) * 15} s)\n   ${e.cue}\n   ${e.load}`);
    });
  }
  if (g.mobility.length) {
    lines.push("", "Flexibilidad (al final)", ...g.mobility.map((m) => `- ${m.name}: ${m.hold}. ${m.cue}`));
  }
  if (g.notes.length) lines.push("", "Notas", ...g.notes.map((n) => `- ${n}`));
  if (g.evidence.length) lines.push("", "Evidencia", ...g.evidence.map((n) => `- ${n}`));
  return lines.join("\n");
}

/** Bloques de la sesión: un solo bloque "gym" con el detalle dentro. */
export function gymBlocks(g: GymSession): WorkoutBlock[] {
  return [{ type: "gym", durationSec: Math.max(300, g.durationSec), targetWatts: 0, gym: g }];
}
