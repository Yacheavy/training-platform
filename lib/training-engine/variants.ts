/**
 * Catálogo de variantes de sesión de ciclismo: qué es cada una, para qué sirve, cuánta evidencia tiene
 * y qué restricciones de uso lleva (separación, frecuencia, duración mínima).
 *
 * Los niveles de evidencia son deliberadamente honestos (investigación del 2026-10-06, abstracts leídos):
 * - ensayo:        hay ensayos en ciclistas con ese protocolo (muestras chicas, pocas semanas).
 * - preliminar:    un ensayo pequeño o resultados parciales.
 * - practica:      práctica de entrenadores; no se encontraron ensayos que la validen.
 * - hipotesis:     hipótesis razonable; el único ensayo disponible no la confirma.
 * - no_concluyente: la evidencia disponible no muestra beneficio.
 */
export type Family = "base" | "umbral" | "vo2" | "neuro" | "fuerza";
export type EvidenceLevel = "ensayo" | "preliminar" | "practica" | "hipotesis" | "no_concluyente";

export interface VariantDef {
  key: string;
  label: string;
  family: Family;
  evidence: EvidenceLevel;
  /** Una línea: en qué se apoya (o por qué no). */
  evidenceNote: string;
  /** Para qué sirve la sesión. */
  purpose: string;
  /** Advertencia opcional que se muestra al atleta. */
  caveat?: string;
  /** 0 = fácil · 1 = moderada/neuromuscular · 2 = umbral · 3 = VO2max */
  intensity: 0 | 1 | 2 | 3;
  vo2?: boolean;
  neuro?: boolean;
  /** Duración mínima del slot (min) para que la variante tenga sentido. */
  minSlotMin: number;
  /** Días mínimos entre dos apariciones de la misma variante. */
  minGapDays: number;
  /** Máximo por semana (de esa variante). */
  maxPerWeek: number;
  /** Se conserva (con la mitad del volumen) en semanas de descarga. */
  maintainable?: boolean;
  /** En rodillo: "ok" se hace igual; "limited" pierde sentido o necesita adaptación. */
  indoor: "ok" | "limited";
}

export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  ensayo: "Con ensayos en ciclistas",
  preliminar: "Evidencia preliminar",
  practica: "Práctica de entrenadores",
  hipotesis: "Hipótesis",
  no_concluyente: "Sin evidencia sólida",
};

export const FAMILY_LABELS: Record<Family, string> = {
  base: "Base aeróbica",
  umbral: "Umbral",
  vo2: "VO2max",
  neuro: "Neuromuscular",
  fuerza: "Fuerza en bici",
};

export const VARIANTS: Record<string, VariantDef> = {
  z2: {
    key: "z2", label: "Z2 · Base", family: "base", evidence: "ensayo",
    evidenceNote: "El volumen en baja intensidad es la base de los modelos polarizado y piramidal (Seiler 2010; Stöggl 2014).",
    purpose: "Volumen aeróbico a intensidad baja y constante.",
    intensity: 0, minSlotMin: 20, minGapDays: 0, maxPerWeek: 7, indoor: "ok",
  },
  z2_progressive: {
    key: "z2_progressive", label: "Z2 progresivo", family: "base", evidence: "practica",
    evidenceNote: "Variante práctica del Z2: no hay ensayos que la comparen con el Z2 plano.",
    purpose: "Rodaje que sube de ~62% a ~74% FTP en tres tramos, siempre dentro de Z2.",
    intensity: 0, minSlotMin: 45, minGapDays: 2, maxPerWeek: 3, indoor: "ok",
  },
  endurance_tempo: {
    key: "endurance_tempo", label: "Tempo en bloques", family: "base", evidence: "practica",
    evidenceNote: "Práctica de entrenadores; sin ensayos propios. Aporta una distribución más piramidal.",
    purpose: "2-3 bloques de 15-25 min al ~82% FTP dentro de un rodaje.",
    caveat: "Es una carga moderada: cuenta como sesión de calidad ligera.",
    intensity: 1, minSlotMin: 75, minGapDays: 5, maxPerWeek: 2, maintainable: true, indoor: "ok",
  },
  long_durability: {
    key: "long_durability", label: "Salida larga con esfuerzo final", family: "base", evidence: "hipotesis",
    evidenceNote: "La durabilidad existe y se asocia al rendimiento (Maunder 2021), pero que esta sesión la mejore es una hipótesis (Matomäki 2023, en personas sin entrenar, no mostró ventaja de la intensidad).",
    purpose: "Z2 largo y 2-3 bloques de ~88% FTP al final, con la fatiga acumulada.",
    intensity: 1, minSlotMin: 150, minGapDays: 10, maxPerWeek: 1, indoor: "limited",
  },
  torque_low_cadence: {
    key: "torque_low_cadence", label: "Torque a cadencia baja", family: "fuerza", evidence: "no_concluyente",
    evidenceNote: "La revisión de Hansen & Rønnestad (2017) no halló beneficio sólido.",
    purpose: "4-5 × 6 min a ~72% FTP a 55 rpm, sentado.",
    caveat: "Si sentís molestia en la rodilla, cortá y volvé a cadencia libre. Para fuerza, lo respaldado es el gimnasio.",
    intensity: 1, minSlotMin: 75, minGapDays: 14, maxPerWeek: 1, indoor: "ok",
  },
  sweet_spot: {
    key: "sweet_spot", label: "Sweet spot", family: "umbral", evidence: "practica",
    evidenceNote: "Práctica de entrenadores (Coggan); no se encontraron ensayos en ciclistas.",
    purpose: "Bloques de 20-30 min al 88-94% FTP.",
    intensity: 2, minSlotMin: 60, minGapDays: 3, maxPerWeek: 2, maintainable: true, indoor: "ok",
  },
  umbral: {
    key: "umbral", label: "Umbral", family: "umbral", evidence: "practica",
    evidenceNote: "Los formatos de umbral no tienen ensayos propios; Stepto 1999 comparó programas de intervalos sobre la contrarreloj (en esta base solo está verificada la cita, no su resultado).",
    purpose: "Bloques de 8-12 min al 95-105% FTP.",
    intensity: 2, minSlotMin: 60, minGapDays: 3, maxPerWeek: 2, maintainable: true, indoor: "ok",
  },
  over_under: {
    key: "over_under", label: "Over-unders", family: "umbral", evidence: "practica",
    evidenceNote: "Práctica de entrenadores; sin ensayos.",
    purpose: "Series de 2' al 94% y 1' al 105% FTP, alternadas, alrededor del umbral.",
    intensity: 2, minSlotMin: 60, minGapDays: 5, maxPerWeek: 1, maintainable: true, indoor: "ok",
  },
  hiit_genuino: {
    key: "hiit_genuino", label: "HIIT genuino", family: "vo2", evidence: "practica",
    evidenceNote: "Protocolo de López Chicharro & Vicente-Campos (2018); la progresión no está validada como la mejor.",
    purpose: "7-10 × 3-4 min al 100% de la potencia en VO2max, con recuperación activa al 50%.",
    intensity: 3, vo2: true, minSlotMin: 45, minGapDays: 6, maxPerWeek: 1, maintainable: true, indoor: "ok",
  },
  ronnestad_30_15: {
    key: "ronnestad_30_15", label: "Rønnestad 30/15", family: "vo2", evidence: "ensayo",
    evidenceNote: "Rønnestad 2015 y 2020: mejoró más que 4×5 min en ciclistas entrenados y de élite (muestras pequeñas, pocas semanas).",
    purpose: "1-3 series de 13 × (30 s / 15 s) a la potencia en VO2max.",
    intensity: 3, vo2: true, minSlotMin: 40, minGapDays: 6, maxPerWeek: 1, maintainable: true, indoor: "ok",
  },
  vo2_long: {
    key: "vo2_long", label: "VO2max largo 5′", family: "vo2", evidence: "ensayo",
    evidenceNote: "Formato largo 4×5 min de Rønnestad 2015/2020 (comparador del 30/15); Seiler 2013 respalda intervalos largos en ciclistas recreativos. La intensidad (~92% PAM) es criterio propio.",
    purpose: "4-5 × 5 min a ~92% de la potencia en VO2max, con 2'30\" de recuperación activa.",
    intensity: 3, vo2: true, minSlotMin: 50, minGapDays: 6, maxPerWeek: 1, maintainable: true, indoor: "ok",
  },
  z2_sprints: {
    key: "z2_sprints", label: "Z2 + sprints", family: "neuro", evidence: "preliminar",
    evidenceNote: "Almquist 2020 y Taylor 2021: ciclistas de élite en transición, muestra pequeña; el seguimiento (Taylor 2021) informa mejor rendimiento de resistencia 6 semanas después de empezar la preparación.",
    purpose: "Rodaje Z2 con 3-9 sprints de 30 s a máxima potencia.",
    intensity: 1, neuro: true, minSlotMin: 90, minGapDays: 5, maxPerWeek: 1, maintainable: true, indoor: "ok",
  },
  sprint_neuro: {
    key: "sprint_neuro", label: "Sprints cortos (6 s)", family: "neuro", evidence: "preliminar",
    evidenceNote: "Kristoffersen 2019 (ciclistas competitivos, ensayo pequeño): mejoró la potencia pico de 6 s sin cambiar el VO2max. Hecho 2 veces por semana durante 6 semanas.",
    purpose: "1-3 series de 4 sprints de ~6 s, sentado y desde parado, dentro de un rodaje Z2.",
    caveat: "Calentá bien antes de los sprints.",
    intensity: 1, neuro: true, minSlotMin: 60, minGapDays: 5, maxPerWeek: 1, maintainable: true, indoor: "ok",
  },
};

export const FAMILY_ORDER: Family[] = ["base", "umbral", "vo2", "neuro", "fuerza"];

export const intensityOf = (key: string): number => VARIANTS[key]?.intensity ?? 0;
export const isVo2Key = (key: string): boolean => !!VARIANTS[key]?.vo2;
export const isNeuroKey = (key: string): boolean => !!VARIANTS[key]?.neuro;
/** Variantes que el atleta puede vetar (todas las de ciclismo salvo el Z2 plano). */
export const BANNABLE_KEYS = Object.keys(VARIANTS).filter((k) => k !== "z2");
