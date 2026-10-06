/**
 * Bibliografía cerrada del asistente. Es la ÚNICA fuente que el chat puede citar.
 * - level: qué tipo de evidencia es (para que el asistente no la presente con más certeza de la que tiene)
 * - checked: "fuente" = leída en la fuente original; "resumen" = a partir del resumen del libro que subió
 *   el entrenador; "memoria" = conocida pero NO releída en la fuente (el asistente debe cuidar el detalle)
 */
export interface Reference {
  id: string;
  surnames: string[]; // para el control automático de citas
  cite: string;
  supports: string;
  level: string;
  checked: "fuente" | "resumen" | "memoria";
}

export const REFERENCES: Reference[] = [
  {
    id: "R1",
    surnames: ["Chicharro", "López Chicharro", "Vicente-Campos"],
    cite: "López Chicharro J, Vicente-Campos D. HIIT. De la teoría a la práctica. 2018 (libro de fisiología del ejercicio).",
    supports: "Parámetros del HIIT genuino (100% PAM, 3 min, 7 reps, recuperación activa ~50%, 1 sesión/semana, calentamiento, vuelta a la calma, pendiente), control por potencia > RPE > FC.",
    level: "Texto de referencia / revisión narrativa. Los datos de cinética del VO2 vienen sobre todo de CARRERA; en bici se extrapola. La progresión que propone no está validada como la mejor (lo dicen los propios autores).",
    checked: "resumen",
  },
  {
    id: "R2",
    surnames: ["Rønnestad", "Ronnestad"],
    cite: "Rønnestad BR, et al. Short intervals induce superior training adaptations compared with long intervals in cyclists – an effort-matched approach. Scand J Med Sci Sports. 2015.",
    supports: "Protocolo 30/15: 30 s de trabajo / 15 s de recuperación al 50% de la potencia del intervalo, 3 series de ~9,5 min (13 repeticiones), 3 min entre series; primera serie en la potencia asociada al VO2max (PAM) y ajuste individual entre series a la máxima intensidad sostenible.",
    level: "Ensayo en ciclistas bien entrenados, muestra pequeña, pocas semanas.",
    checked: "fuente",
  },
  {
    id: "R3",
    surnames: ["Rønnestad", "Ronnestad"],
    cite: "Rønnestad BR, et al. Superior performance improvements in elite cyclists following short-interval vs effort-matched long-interval training. Scand J Med Sci Sports. 2020.",
    supports: "Mismo esquema 30/15 en ciclistas de élite; consigna de máxima intensidad sostenible.",
    level: "Ensayo en ciclistas de élite, muestra pequeña.",
    checked: "memoria",
  },
  {
    id: "R4",
    surnames: ["Alfonso", "Clarke", "Capdevila"],
    cite: "Alfonso C, Clarke DC, Capdevila L. Individual training prescribed by heart rate variability, heart rate and well-being scores in experienced cyclists. Sci Rep. 2025;15:34023. doi:10.1038/s41598-025-13540-z.",
    supports: "Combinar HRV vagal + bienestar subjetivo + FC de reposo para personalizar el entrenamiento dio mejores resultados que guiarse solo por HRV (mejoras en esfuerzos de 5 y 20 min).",
    level: "28 ciclistas varones, 40 días, grupos de 8-12 personas: evidencia PRELIMINAR, no concluyente.",
    checked: "fuente",
  },
  {
    id: "R5",
    surnames: ["Plews"],
    cite: "Plews DJ, et al. Training adaptation and heart rate variability in elite endurance athletes: opening the door to effective monitoring. Sports Med. 2013.",
    supports: "Interpretar LnRMSSD frente a la línea base propia y la media de 7 días; un valor aislado de un día no es una señal confiable.",
    level: "Estudios de caso/series en atletas de élite.",
    checked: "memoria",
  },
  {
    id: "R6",
    surnames: ["Billat"],
    cite: "Billat LV. Interval training for performance: a scientific and empirical practice. Part I: aerobic interval training. Sports Med. 2001;31(1).",
    supports: "Descripción del método 30-30 (alternar ~100% y ~50% de vVO2max) como forma de acumular tiempo cerca del VO2max.",
    level: "Revisión (carrera a pie), extrapolada a ciclismo.",
    checked: "memoria",
  },
  {
    id: "R7",
    surnames: ["Seiler"],
    cite: "Seiler S. What is best practice for training intensity and duration distribution in endurance athletes? Int J Sports Physiol Perform. 2010;5(3).",
    supports: "Distribución de intensidades en atletas de resistencia: gran parte del volumen en baja intensidad (modelo ~80/20), una minoría en alta intensidad.",
    level: "Revisión; datos observacionales de atletas de élite.",
    checked: "memoria",
  },
  {
    id: "R8",
    surnames: ["Kenneally"],
    cite: "Kenneally M, Casado A, Santos-Concejero J. 2017 (revisión citada en R1 sobre distribución de intensidad en corredores de media y larga distancia).",
    supports: "~80% a baja intensidad (hasta VT1) y ~20% por encima en corredores; citada vía R1.",
    level: "Revisión en corredores, no en ciclistas.",
    checked: "resumen",
  },
  {
    id: "R9",
    surnames: ["Jeukendrup"],
    cite: "Jeukendrup AE. A step towards personalized sports nutrition: carbohydrate intake during exercise. Sports Med. 2014;44(Suppl 1).",
    supports: "Carbohidrato durante el ejercicio según duración; una sola fuente se satura cerca de ~60 g/h; con mezcla glucosa:fructosa se llega hasta ~90 g/h en ejercicios largos.",
    level: "Revisión narrativa de expertos.",
    checked: "memoria",
  },
  {
    id: "R10",
    surnames: ["ACSM", "Thomas"],
    cite: "Thomas DT, Erdman KA, Burke LM. ACSM/AND/DC Position Stand: Nutrition and athletic performance. 2016.",
    supports: "Recomendaciones generales de carbohidrato intra-entreno por duración.",
    level: "Consenso de expertos (posicionamiento oficial).",
    checked: "memoria",
  },
  {
    id: "R11",
    surnames: ["Sanders"],
    cite: "Sanders D, et al. Methods of monitoring training load and their relationships to changes in fitness and performance in competitive road cyclists. Int J Sports Physiol Perform. 2017.",
    supports: "La carga interna (iTRIMP/luTRIMP) mostró la relación dosis-respuesta más fuerte con el rendimiento; el TSS también se asoció, algo menos.",
    level: "Estudio observacional en un grupo pequeño de ciclistas: correlación, no garantía individual.",
    checked: "memoria",
  },
  {
    id: "R12",
    surnames: ["Bosquet"],
    cite: "Bosquet L, et al. Effects of tapering on performance: a meta-analysis. Med Sci Sports Exerc. 2007.",
    supports: "Taper de ~2 semanas, reduciendo el volumen 41-60% sin tocar intensidad ni frecuencia.",
    level: "Metaanálisis.",
    checked: "memoria",
  },
  {
    id: "R13",
    surnames: ["Kiely"],
    cite: "Kiely J. Periodization paradigms in the 21st century: evidence-led or tradition-driven? Int J Sports Physiol Perform. 2012; y Kiely J. Periodization theory: confronting an inconvenient truth. Sports Med. 2018.",
    supports: "La periodización rígida por bloques tiene poco fundamento de evidencia; conviene planificar de forma flexible según el estado del atleta.",
    level: "Revisiones críticas / posición.",
    checked: "memoria",
  },
  {
    id: "R14",
    surnames: ["Hooper", "Mackinnon"],
    cite: "Hooper SL, Mackinnon LT. Monitoring overtraining in athletes. Sports Med. 1995.",
    supports: "Índice de Hooper: check-in breve de sueño, fatiga, estrés y dolor muscular (escala 1-7).",
    level: "Herramienta de campo.",
    checked: "memoria",
  },
  {
    id: "R15",
    surnames: ["Javaloyes"],
    cite: "Javaloyes A, et al. Entrenamiento guiado por HRV en ciclistas (ensayos del grupo de Javaloyes).",
    supports: "Entrenar guiado por HRV dio resultados similares o algo mejores que un plan fijo con menos sesiones de alta intensidad.",
    level: "Ensayos pequeños; los metaanálisis lo ven prometedor pero heterogéneo y de calidad limitada.",
    checked: "memoria",
  },
];

/** Apellidos que se aceptan como citas (el resto se marca como no verificado). */
export const ALLOWED_CITATION_SURNAMES = new Set(
  REFERENCES.flatMap((r) => r.surnames).map((s) => s.toLowerCase())
);

export function referencesPrompt(): string {
  const lines = REFERENCES.map(
    (r) =>
      `[${r.id}] ${r.cite}\n    Respalda: ${r.supports}\n    Nivel de evidencia: ${r.level}\n    Verificación: ${
        r.checked === "fuente" ? "leída en la fuente original" : r.checked === "resumen" ? "a partir de un resumen del libro" : "conocida, no releída en la fuente (no agregues detalles que no estén acá)"
      }`
  );
  return `--- BIBLIOGRAFÍA CERRADA (única fuente permitida para citar) ---\n${lines.join("\n")}\n`;
}
