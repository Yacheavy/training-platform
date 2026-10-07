/**
 * Sugerencias breves de ejecución por tipo de estímulo. No son
 * hallazgos de investigación puntual — son buenas prácticas de pacing
 * ampliamente aceptadas en ciencia del deporte para cada tipo de
 * sesión, consistentes con los protocolos que ya usamos (Chicharro/
 * Vicente-Campos para HIIT, Seiler para polarización/Z2).
 */
export function getExecutionTips(stimulusType: string): string[] {
  const tips: Record<string, string[]> = {
    hiit_genuino: [
      "No salgas fuerte en el primer intervalo — el objetivo es sostener la potencia target en los 7, no quemarte en el primero.",
      "Si en el intervalo 4-5 no llegás al watt objetivo, priorizá terminar la cantidad de repeticiones antes que la potencia exacta.",
      "La recuperación activa (no pasiva) ayuda a llegar mejor al siguiente intervalo — no pares del todo.",
      "Guiate por la potencia, no por la frecuencia cardíaca: en los primeros minutos la FC sube más rápido que el VO2 y después se estanca; es el peor indicador de intensidad en HIIT.",
      "Hacelo en llano o con rampa mínima: en subida la fatiga muscular te impide llegar al estrés cardiovascular buscado.",
      "Criterio de ajuste: tenés que poder completar los 7 intervalos y no más. Si no llegás, anotalo; si te sobra, anotalo también.",
    ],
    sweet_spot: [
      "Evitá arrancar el primer bloque muy fuerte — sweet spot se siente 'cómodo' al principio pero acumula fatiga real.",
      "Mantené cadencia estable, no compenses con más cadencia si cae la potencia.",
    ],
    umbral: [
      "Este es el estímulo que más se siente en el pecho/respiración — es esperable, no bajes la potencia por eso solo.",
      "Si no llegás al watt objetivo en el último bloque, es mejor bajar 5-10W que cortar el bloque.",
    ],
    ronnestad_30_15: [
      "Arrancá la primera serie en tu potencia en VO2max (es el punto de partida del protocolo). Entre series ajustá: si terminaste las 13 repeticiones sin caerte, subí 5-10 W; si no llegaste, bajá. La consigna original es la máxima intensidad sostenible.",
      "Los 15s de recuperación son cortos a propósito — no bajes del todo la cadencia, mantenés el pedaleo suave.",
      "Es normal sentir acumulación fuerte hacia la serie 2-3, el objetivo es aguantar el patrón, no ir sobrado al principio.",
    ],
    z2_sprints: [
      "Es un rodaje suave con sprints de 30 s a máxima potencia (en series de hasta 3): el resto de la salida es Z2 de verdad, conversando.",
      "Cada sprint es explosivo y sentado, arrancando a ~80 rpm y con resistencia alta; la potencia va a caer en el 2º y 3º (es normal). El número del plan es solo un piso de referencia: el esfuerzo es máximo y suele superarlo.",
      "Los 4 min entre sprints son suaves (~100 W): recuperá casi por completo antes del siguiente.",
      "Si el gimnasio del día anterior te dejó las piernas cargadas o te sentís mal, hacelo como Z2 puro y salteá los sprints.",
    ],
    z2_progressive: [
      "Arrancá bien suave y subí un escalón cada tercio de la salida; el último tercio sigue siendo Z2 alto (conversación entrecortada, no jadeo).",
      "Si el último tercio te deja fatigado para el día siguiente, quedate en el escalón del medio: es una sesión de base, no de calidad.",
    ],
    endurance_tempo: [
      "Los bloques van por debajo del umbral: tienen que sentirse sostenibles, 'firmes pero controlados'. Si te cuesta hablar una frase corta, bajá unos watts.",
      "Los 5 min de Z2 entre bloques son parte de la sesión: recuperá de verdad antes del siguiente.",
    ],
    over_under: [
      "El 'over' (1 min, ~105% FTP) no es un sprint: apenas por encima del umbral; el 'under' (2 min) NO es recuperación, sostené el esfuerzo.",
      "Pasá de under a over con suavidad (subí de a poco los 10-15 s previos) y mantené cadencia estable.",
      "Entre series (5 min Z2) soltá de verdad. Si no sostenés la última serie, cortala antes de perder la forma.",
    ],
    vo2_long: [
      "Cinco minutos es largo: no salgas por encima del watt objetivo en el primer minuto o no llegás al último intervalo.",
      "Guiate por la potencia; la frecuencia cardíaca tarda 1-2 min en subir y en los intervalos largos sube con deriva.",
      "Recuperación de 2:30 al ~50%: pedaleá suave, no pares. Si no completás la última repetición, anotalo.",
    ],
    sprint_neuro: [
      "Cada sprint dura apenas 6 s: salí desde casi parado, sentado, con resistencia alta, y acelerá al máximo sostenido hasta el final.",
      "Recuperá bien (2 min) entre sprints y 5 min entre series: la calidad de cada sprint importa más que la cantidad.",
      "Hacelo en llano o en falsa bajada controlada y con buen agarre. Si hay dolor o molestia (cadera, rodilla, espalda), cortá la serie.",
      "No hacerlo con piernas muy cargadas ni el día después de una sesión dura.",
    ],
    long_durability: [
      "La primera parte es Z2 de verdad: la idea es llegar a los bloques finales ya con fatiga acumulada, sin haberte pasado antes.",
      "En los bloques finales sostené la potencia (~88% FTP) con cadencia estable; si la potencia cae mucho, cortá el último bloque.",
      "Comé y tomá según el plan de nutrición (este es el tipo de salida donde más importa).",
    ],
    torque_low_cadence: [
      "Cadencia baja (~55 rpm) pero potencia moderada: es fuerza específica, no esfuerzo máximo. Hacelo sentado y en llano o falsa subida.",
      "Si sentís molestia en las rodillas, subí la cadencia o cortá: es lo primero que se resiente con este trabajo.",
      "La evidencia de este tipo de sesión no es concluyente: es una variante de variedad, no una prioridad.",
    ],
    z2: [
      "Mantené la conversación posible — si no podés hablar en frases completas, estás por encima de Z2.",
      "Cadencia constante, sin necesidad de forzar watts si el terreno cambia (viento, subida leve).",
    ],
    rst: [
      "Estos son esfuerzos neuromusculares, no cardiovasculares — la recuperación tiene que sentirse casi completa antes del próximo sprint.",
    ],
    gym: [
      "Priorizá técnica sobre carga si venís de una sesión de bici dura la sesión anterior.",
    ],
  };

  return tips[stimulusType] ?? ["Ejecutá según sensación del día — si algo no cierra, priorizá completar por sobre forzar el número exacto."];
}