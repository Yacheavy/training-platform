import { carbTargetGPerHour } from "./fueling";

/**
 * Análisis de nutrición intra-entrenamiento vs. rendimiento. Módulo puro (sin base de datos).
 *
 * Es DESCRIPTIVO: compara sesiones con buena y mala ingesta de carbohidratos y muestra
 * diferencias en desacople, cumplimiento de carga y eficiencia. Una asociación no prueba causa
 * (calor, sueño, intensidad y duración también influyen), y el texto lo aclara siempre.
 * Objetivos de CHO: Jeukendrup 2014; ACSM/AND/DC 2016 (ver fueling.ts).
 */

export const MIN_ELIGIBLE_SEC = 60 * 60; // solo sesiones de 1 h o más aportan al análisis
export const UNDERFUELED_RATIO = 0.6; // < 60% del objetivo
export const WELL_FUELED_RATIO = 0.8; // ≥ 80% del objetivo
export const MIN_GROUP = 3; // sesiones mínimas por grupo para comparar

export interface NutritionActivityInput {
  id: string;
  dateKey: string; // YYYY-MM-DD local
  name: string | null;
  durationSec: number;
  tss: number | null;
  plannedTss: number | null;
  intensityFactor: number | null;
  decouplingPct: number | null;
  efficiencyFactor: number | null;
  /** g/h que sugería el plan para esa sesión (si estaba vinculada); null = calcular por duración */
  plannedCarbsPerHour: number | null;
  carbsG: number | null; // ya resuelto: manual o Intervals
  fluidMl: number | null;
  sodiumMg: number | null;
  giComfort: number | null;
}

export interface SessionNutrition {
  id: string;
  dateKey: string;
  name: string | null;
  hours: number;
  targetGPerHour: number;
  carbsPerHour: number | null;
  fluidPerHour: number | null;
  sodiumPerHour: number | null;
  ratio: number | null; // ingesta / objetivo
  eligible: boolean;
  giComfort: number | null;
  decouplingPct: number | null;
  loadCompliance: number | null; // TSS real / TSS planeado
  efficiencyFactor: number | null;
}

export interface GroupStats {
  n: number;
  decoupling: number | null;
  loadCompliance: number | null;
  efficiencyFactor: number | null;
}

export interface NutritionSummary {
  windowDays: number;
  sessions: SessionNutrition[];
  eligible: number;
  logged: number;
  coveragePct: number | null;
  avgCarbsPerHour: number | null;
  avgTargetPerHour: number | null;
  avgRatio: number | null;
  avgFluidPerHour: number | null;
  underfueled: number;
  well: GroupStats | null;
  under: GroupStats | null;
  comparable: boolean;
  tolerance: { comfortableMax: number | null; troubleFrom: number | null } | null;
  insights: string[];
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

function group(list: SessionNutrition[]): GroupStats {
  return {
    n: list.length,
    decoupling: mean(list.filter((s) => s.decouplingPct != null).map((s) => s.decouplingPct as number)),
    loadCompliance: mean(list.filter((s) => s.loadCompliance != null).map((s) => s.loadCompliance as number)),
    efficiencyFactor: mean(list.filter((s) => s.efficiencyFactor != null).map((s) => s.efficiencyFactor as number)),
  };
}

export function toSessionNutrition(a: NutritionActivityInput): SessionNutrition {
  const hours = a.durationSec / 3600;
  const intense = (a.intensityFactor ?? 0) > 3 ? a.intensityFactor! / 100 >= 0.8 : (a.intensityFactor ?? 0) >= 0.8;
  const target = a.plannedCarbsPerHour != null && a.plannedCarbsPerHour > 0 ? a.plannedCarbsPerHour : carbTargetGPerHour(hours, intense);
  const carbsPerHour = a.carbsG != null && hours > 0 ? a.carbsG / hours : null;
  return {
    id: a.id,
    dateKey: a.dateKey,
    name: a.name,
    hours,
    targetGPerHour: target,
    carbsPerHour,
    fluidPerHour: a.fluidMl != null && hours > 0 ? a.fluidMl / hours : null,
    sodiumPerHour: a.sodiumMg != null && hours > 0 ? a.sodiumMg / hours : null,
    ratio: carbsPerHour != null && target > 0 ? carbsPerHour / target : null,
    eligible: a.durationSec >= MIN_ELIGIBLE_SEC && target > 0,
    giComfort: a.giComfort,
    decouplingPct: a.decouplingPct,
    loadCompliance: a.tss != null && a.plannedTss != null && a.plannedTss > 0 ? a.tss / a.plannedTss : null,
    efficiencyFactor: a.efficiencyFactor,
  };
}

export function analyzeNutrition(activities: NutritionActivityInput[], windowDays = 42): NutritionSummary {
  const sessions = activities.map(toSessionNutrition).sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
  const eligibleList = sessions.filter((s) => s.eligible);
  const loggedList = eligibleList.filter((s) => s.carbsPerHour != null);

  const avgCarbs = mean(loggedList.map((s) => s.carbsPerHour as number));
  const avgTarget = mean(loggedList.map((s) => s.targetGPerHour));
  const avgRatio = mean(loggedList.filter((s) => s.ratio != null).map((s) => s.ratio as number));
  const fluidList = eligibleList.filter((s) => s.fluidPerHour != null && s.hours >= 1.5);
  const avgFluid = mean(fluidList.map((s) => s.fluidPerHour as number));
  const underList = loggedList.filter((s) => (s.ratio ?? 1) < UNDERFUELED_RATIO);
  const wellList = loggedList.filter((s) => (s.ratio ?? 0) >= WELL_FUELED_RATIO);

  const well = wellList.length ? group(wellList) : null;
  const under = underList.length ? group(underList) : null;
  const comparable = wellList.length >= MIN_GROUP && underList.length >= MIN_GROUP;

  // Tolerancia digestiva: hasta qué g/h no hubo molestias y desde cuál aparecieron
  const withGi = loggedList.filter((s) => s.giComfort != null);
  const okMax = Math.max(0, ...withGi.filter((s) => (s.giComfort as number) >= 2).map((s) => s.carbsPerHour as number));
  const troubles = withGi.filter((s) => s.giComfort === 1).map((s) => s.carbsPerHour as number);
  const tolerance = withGi.length >= 2 ? { comfortableMax: okMax > 0 ? Math.round(okMax) : null, troubleFrom: troubles.length ? Math.round(Math.min(...troubles)) : null } : null;

  const insights: string[] = [];
  const coveragePct = eligibleList.length ? Math.round((loggedList.length / eligibleList.length) * 100) : null;

  if (eligibleList.length >= 3 && coveragePct != null && coveragePct < 60) {
    insights.push(`Solo registraste la nutrición de ${loggedList.length} de ${eligibleList.length} sesiones de 1 h o más: con tan pocos datos no se pueden sacar patrones confiables.`);
  }
  if (avgRatio != null && loggedList.length >= 3) {
    if (avgRatio < UNDERFUELED_RATIO) {
      insights.push(`En promedio consumís ~${Math.round(avgCarbs as number)} g/h de CHO contra ~${Math.round(avgTarget as number)} g/h sugeridos (${Math.round(avgRatio * 100)}% del objetivo): quedás sistemáticamente corto.`);
    } else if (avgRatio < WELL_FUELED_RATIO) {
      insights.push(`Consumís ~${Math.round(avgCarbs as number)} g/h de CHO contra ~${Math.round(avgTarget as number)} g/h sugeridos (${Math.round(avgRatio * 100)}%): cerca, pero con margen para completar.`);
    } else {
      insights.push(`Cumplís el objetivo de carbohidratos: ~${Math.round(avgCarbs as number)} g/h contra ~${Math.round(avgTarget as number)} g/h sugeridos (${Math.round(avgRatio * 100)}%).`);
    }
  }
  const lastThree = loggedList.slice(-3);
  if (lastThree.length === 3 && lastThree.every((s) => (s.ratio ?? 1) < 0.7)) {
    insights.push("Las últimas 3 sesiones largas registradas quedaron por debajo del 70% del objetivo de CHO.");
  }
  if (comparable && well && under) {
    const parts: string[] = [];
    if (well.decoupling != null && under.decoupling != null && Math.abs(under.decoupling - well.decoupling) >= 2) {
      parts.push(`desacople Pw:HR ${r1(under.decoupling)}% vs ${r1(well.decoupling)}% (subalimentadas vs bien alimentadas)`);
    }
    if (well.loadCompliance != null && under.loadCompliance != null && Math.abs(under.loadCompliance - well.loadCompliance) >= 0.08) {
      parts.push(`carga real/planificada ${Math.round(under.loadCompliance * 100)}% vs ${Math.round(well.loadCompliance * 100)}%`);
    }
    if (well.efficiencyFactor != null && under.efficiencyFactor != null && Math.abs(under.efficiencyFactor - well.efficiencyFactor) / well.efficiencyFactor >= 0.04) {
      parts.push(`factor de eficiencia ${under.efficiencyFactor.toFixed(2)} vs ${well.efficiencyFactor.toFixed(2)}`);
    }
    insights.push(
      parts.length
        ? `Comparando ${under.n} sesiones con poca ingesta contra ${well.n} bien alimentadas: ${parts.join("; ")}. Es una asociación, no una prueba de causa (calor, sueño y duración también influyen).`
        : `Comparando ${under.n} sesiones con poca ingesta contra ${well.n} bien alimentadas no aparece una diferencia clara en desacople, carga cumplida ni eficiencia.`
    );
  } else if (loggedList.length >= 3) {
    insights.push(`Todavía no hay suficientes sesiones de cada tipo para comparar rendimiento (se necesitan al menos ${MIN_GROUP} bien alimentadas y ${MIN_GROUP} con poca ingesta; hay ${wellList.length} y ${underList.length}).`);
  }
  if (avgFluid != null && fluidList.length >= 2 && avgFluid < 300) {
    insights.push(`Líquido en sesiones de 90 min o más: ~${Math.round(avgFluid)} ml/h, por debajo del rango orientativo de 400–800 ml/h (varía según sudoración y clima).`);
  }
  if (tolerance && (tolerance.comfortableMax != null || tolerance.troubleFrom != null)) {
    insights.push(
      `Tolerancia digestiva: sin molestias hasta ~${tolerance.comfortableMax ?? "?"} g/h${tolerance.troubleFrom != null ? `; aparecieron molestias desde ~${tolerance.troubleFrom} g/h` : ""}.`
    );
  }

  return {
    windowDays,
    sessions,
    eligible: eligibleList.length,
    logged: loggedList.length,
    coveragePct,
    avgCarbsPerHour: avgCarbs,
    avgTargetPerHour: avgTarget,
    avgRatio,
    avgFluidPerHour: avgFluid,
    underfueled: underList.length,
    well,
    under,
    comparable,
    tolerance,
    insights,
  };
}

const GI_LABEL: Record<number, string> = { 1: "con molestias", 2: "aceptable", 3: "sin problemas" };

/** Una línea por sesión para el contexto del chat (sin inventar: lo no registrado se marca "sin dato"). */
export function describeSessionNutrition(s: SessionNutrition, a: Pick<NutritionActivityInput, "carbsG" | "fluidMl" | "sodiumMg">): string {
  const parts: string[] = [];
  // El veredicto sale de la cuenta hecha acá: el modelo no debe comparar estos números por su cuenta
  const carbVerdict = (r: number | null) => (r == null ? "" : r >= 1.15 ? ", por ENCIMA de lo sugerido" : r >= 0.9 ? ", en línea con lo sugerido" : r >= 0.7 ? ", algo POR DEBAJO de lo sugerido" : ", claramente POR DEBAJO de lo sugerido");
  parts.push(
    a.carbsG != null && s.carbsPerHour != null
      ? `CHO ${Math.round(a.carbsG)} g (${Math.round(s.carbsPerHour)} g/h${s.targetGPerHour > 0 ? ` vs ${Math.round(s.targetGPerHour)} g/h sugeridos${s.ratio != null ? ` = ${Math.round(s.ratio * 100)}% de lo sugerido${carbVerdict(s.ratio)}` : ""}` : ""})`
      : `CHO sin dato${s.targetGPerHour > 0 ? ` (sugeridos ~${Math.round(s.targetGPerHour)} g/h)` : ""}`
  );
  if (a.fluidMl != null && s.fluidPerHour != null) {
    const f = Math.round(s.fluidPerHour);
    const fv = s.hours < 1 ? "" : f < 400 ? ", POR DEBAJO del rango orientativo de 400–800 ml/h (varía según sudoración y clima)" : f <= 800 ? ", dentro del rango orientativo de 400–800 ml/h" : ", por encima del rango orientativo de 400–800 ml/h";
    parts.push(`líquido ${a.fluidMl} ml (${f} ml/h${fv})`);
  } else parts.push("líquido sin dato");
  if (a.sodiumMg != null) parts.push(`sodio ${a.sodiumMg} mg`);
  if (s.giComfort != null) parts.push(`tolerancia digestiva ${GI_LABEL[s.giComfort] ?? s.giComfort}`);
  return parts.join(", ");
}
