/**
 * Planificador de temporada (módulo puro, sin base de datos). Propone los bloques que faltan hasta el objetivo principal.
 *
 * Fechas como claves YYYY-MM-DD (sin zona horaria). Un bloque va de `startKey` (incluido) a `endKey` (excluido), igual que
 * los bloques ya guardados: el siguiente empieza el día que termina el anterior.
 *
 * Evidencia (honesta): no hay un orden de fases ni un modelo de periodización con respaldo sólido en ciclistas entrenados
 * (Galán-Rioja 2023: sin preponderancia de evidencia a favor de un modelo). El orden base → umbral → VO2max → puesta a punto es
 * la convención de práctica; el taper de ~2 semanas con la intensidad conservada se apoya en Bosquet 2007 (metaanálisis).
 */
export type Objective = "base" | "umbral" | "vo2max" | "tapering";

export interface SeasonGoal {
  name: string;
  type: "EVENT" | "PERFORMANCE";
  dateKey: string;
  metric?: string | null;
}
export interface ExistingBlock {
  objective: string;
  startKey: string;
  endKey: string;
}
export interface ProposedBlock {
  name: string;
  objective: Objective;
  startKey: string;
  endKey: string;
  weeks: number;
  why: string;
}
export interface SeasonProposal {
  /** El plan actual ya llega al objetivo (o no hay nada que proponer). */
  covered: boolean;
  blocks: ProposedBlock[];
  notes: string[];
  goalName: string;
}

const DAY = 86400000;
const keyMs = (k: string) => new Date(k + "T00:00:00Z").getTime();
const msKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (k: string, d: number) => msKey(keyMs(k) + d * DAY);
const diffDays = (a: string, b: string) => Math.round((keyMs(b) - keyMs(a)) / DAY);

export const MIN_BLOCK_WEEKS = 3;
const OBJ_LABEL: Record<Objective, string> = { base: "Base", umbral: "Umbral", vo2max: "VO2max", tapering: "Puesta a punto" };
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Orden de las fases y reparto del tiempo según el tipo de objetivo. */
const PATHS: Record<SeasonGoal["type"], { order: Objective[]; weights: Record<string, number> }> = {
  // Evento (carrera): base → umbral → VO2max → puesta a punto
  EVENT: { order: ["base", "umbral", "vo2max"], weights: { base: 0.4, umbral: 0.3, vo2max: 0.3 } },
  // Objetivo de rendimiento (p. ej. subir el FTP): la última fase es la más cercana al test, o sea umbral
  PERFORMANCE: { order: ["base", "vo2max", "umbral"], weights: { base: 0.3, vo2max: 0.35, umbral: 0.35 } },
};

function blockName(obj: Objective, startKey: string, endKey: string): string {
  const s = new Date(keyMs(startKey));
  const e = new Date(keyMs(addDays(endKey, -1)));
  const sm = MONTHS[s.getUTCMonth()];
  const em = MONTHS[e.getUTCMonth()];
  const span = sm === em ? sm : `${sm}/${em}`;
  return `Bloque ${OBJ_LABEL[obj]} — ${span} ${e.getUTCFullYear()}`;
}

const WHY: Record<Objective, string> = {
  base: "Volumen aeróbico y sweet spot para construir la base antes de la intensidad (convención de práctica; sin ensayos que prefieran un orden de fases).",
  umbral: "Trabajo cerca del FTP: es el estímulo más directo sobre el umbral (práctica de entrenadores).",
  vo2max: "Intervalos de VO2max (HIIT genuino y variantes): estímulo con respaldo en ciclistas entrenados; una sesión por semana, 48 h de separación.",
  tapering: "Puesta a punto: el volumen baja ~40–55% en las últimas 2 semanas manteniendo intensidad y frecuencia (Bosquet 2007).",
};

export function proposeSeason(input: { todayKey: string; goal: SeasonGoal | null; existing: ExistingBlock[] }): SeasonProposal {
  const { todayKey, goal } = input;
  if (!goal) return { covered: true, blocks: [], notes: ["Cargá un objetivo con fecha (un evento o una meta de rendimiento) para que la app proponga la temporada."], goalName: "" };
  const notes: string[] = [];
  const relevant = input.existing.filter((b) => b.endKey > todayKey).sort((a, b) => (a.startKey < b.startKey ? -1 : 1));
  const last = relevant[relevant.length - 1];
  const start = last && last.endKey > todayKey ? last.endKey : todayKey;
  const end = goal.dateKey;

  const days = diffDays(start, end);
  if (days <= 0) return { covered: true, blocks: [], notes: ["Los bloques que ya tenés llegan hasta la fecha del objetivo."], goalName: goal.name };
  if (days < 7) return { covered: true, blocks: [], notes: [`Faltan menos de 7 días entre el último bloque y el objetivo (${days}): no alcanza para otro bloque.`], goalName: goal.name };

  const path = PATHS[goal.type];
  let remainingDays = days;
  const out: ProposedBlock[] = [];

  // Puesta a punto (solo para eventos): 2 semanas si hay margen, 1 si el margen es corto
  let taperDays = 0;
  if (goal.type === "EVENT") {
    const weeksAvail = remainingDays / 7;
    taperDays = weeksAvail >= 6 ? 14 : weeksAvail >= 3 ? 7 : 0;
    if (taperDays === 0) notes.push("Queda muy poco tiempo antes del evento: solo se propone mantener la forma, sin puesta a punto formal.");
  }
  remainingDays -= taperDays;

  // Fases que faltan: las que vienen después de la fase del último bloque existente
  let order = path.order;
  if (last) {
    const idx = order.indexOf(last.objective as Objective);
    if (idx >= 0) order = order.slice(idx + 1);
    else if (last.objective === "tapering") order = [];
  }
  if (order.length === 0) {
    // El último bloque ya era la fase final y sobra tiempo: se repite la fase final (si hay mucho tiempo, se reinicia desde la base)
    order = remainingDays / 7 > 8 ? path.order : [path.order[path.order.length - 1]];
    if (last) notes.push(`Tu último bloque ya era de ${OBJ_LABEL[(last.objective as Objective)] ?? last.objective}: se propone ${order.length > 1 ? "reiniciar el ciclo desde la base" : "una nueva fase final"} para llegar a la fecha.`);
  }

  // Descartar las fases más tempranas hasta que cada bloque tenga al menos MIN_BLOCK_WEEKS semanas
  const totalWeeks = remainingDays / 7;
  while (order.length > 1 && totalWeeks / order.length < MIN_BLOCK_WEEKS) order = order.slice(1);
  if (order.length > 0 && remainingDays > 0) {
    const wsum = order.reduce((s, o) => s + (path.weights[o] ?? 1), 0);
    let cursor = start;
    let daysLeft = remainingDays;
    order.forEach((obj, i) => {
      const isLast = i === order.length - 1;
      let d = isLast ? daysLeft : Math.max(MIN_BLOCK_WEEKS, Math.round((totalWeeks * (path.weights[obj] ?? 1)) / wsum)) * 7;
      if (!isLast) d = Math.min(d, daysLeft - MIN_BLOCK_WEEKS * 7 * (order.length - 1 - i));
      const bEnd = addDays(cursor, d);
      out.push({ name: blockName(obj, cursor, bEnd), objective: obj, startKey: cursor, endKey: bEnd, weeks: Math.round(d / 7), why: WHY[obj] });
      cursor = bEnd;
      daysLeft -= d;
    });
  }
  if (taperDays > 0) {
    const tStart = out.length ? out[out.length - 1].endKey : start;
    out.push({ name: blockName("tapering", tStart, end), objective: "tapering", startKey: tStart, endKey: end, weeks: Math.round(taperDays / 7), why: WHY.tapering });
  }

  if (goal.type === "PERFORMANCE") {
    notes.push(`El test de FTP se programa según tus reglas (cada N semanas, la primera semana tras una descarga): conviene que el último caiga cerca del ${end} para comprobar la meta${goal.metric ? ` (${goal.metric})` : ""}.`);
  }
  if (out.length === 0) return { covered: true, blocks: [], notes: [...notes, "No hay tiempo para otro bloque."], goalName: goal.name };
  return { covered: false, blocks: out, notes, goalName: goal.name };
}

/** Elige el objetivo principal: prioridad A > B > C y, a igual prioridad, el más cercano que todavía no pasó. */
export function pickPrimaryGoal<T extends { priority: string; dateKey: string | null }>(goals: T[], todayKey: string): T | null {
  const future = goals.filter((g) => g.dateKey && g.dateKey > todayKey);
  future.sort((a, b) => (a.priority === b.priority ? (a.dateKey! < b.dateKey! ? -1 : 1) : a.priority < b.priority ? -1 : 1));
  return future[0] ?? null;
}
