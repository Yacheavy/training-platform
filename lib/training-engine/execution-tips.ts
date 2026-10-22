/**
 * Sugerencias breves de ejecución por tipo de estímulo. No son
 * hallazgos de investigación puntual — son buenas prácticas de pacing
 * ampliamente aceptadas en ciencia del deporte para cada tipo de
 * sesión, consistentes con los protocolos que ya usamos (Chicharro/
 * Vicente-Campos para HIIT, Seiler para polarización/Z2).
 */
export function getExecutionTips(stimulusType: string): string[] {
  const tips: Record<string, string[]> = {
    activacion: [
      "Las aperturas son cortas y de ritmo de carrera, no de esfuerzo máximo: terminá cada una con la sensación de que podías hacer otra.",
      "Recuperá por completo entre aperturas (2′30″ suaves). Si las piernas están pesadas, salteá las aperturas y hacé solo el rodaje.",
      "No es una sesión para sumar forma: la forma que hay es la de las últimas semanas. Hidratate bien y comé normal, sin probar comidas nuevas.",
    ],
    calentamiento_carrera: [
      "Empezá unos 30 min antes de la largada para terminar 10–15 min antes. Después quedate suave y tomá agua; evitá enfriarte parado.",
      "Si la prueba es larga (más de 2 h), hacé solo hasta la primera activación: no gastes piernas en el calentamiento.",
      "Si la prueba arranca fuerte (criterium, contrarreloj corta, ruta con subida al inicio), hacé las dos activaciones completas.",
    ],
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
    vo2_pmax: [
      "Son pocos intervalos y largos de recuperación: 2′40″ a tu potencia en VO2max, y 5′20″ pedaleando suave. Es una sesión larga (~90 min) por las pausas, no por el esfuerzo.",
      "Arrancá cada intervalo en el watt objetivo, sin pasarte en los primeros 30 s: tenés que llegar al último con la misma potencia.",
      "La duración fija de 2′40″ es una aproximación: el ensayo usaba el 60% de tu tiempo máximo a esa potencia. Si te sobra mucho, anotalo.",
    ],
    vo2_supra_30: [
      "Cada esfuerzo dura 30 s y es casi máximo (por encima de tu potencia en VO2max). El número del plan es una referencia: no pasa nada si en las últimas repeticiones no llegás.",
      "Los 4′30″ de recuperación son fáciles a propósito: soltá las piernas y recuperá casi por completo antes del siguiente.",
      "Salí sentado y con resistencia alta, en llano o falsa bajada controlada. Si hay dolor o molestia, cortá la serie.",
      "No lo hagas con piernas muy cargadas ni el día después de una sesión dura.",
    ],
    vo2_corto_15_15: [
      "Es como el 30/15 pero con intervalos de 15 s: arrancá en tu potencia en VO2max y ajustá entre series según cómo te sintas.",
      "Los 15 s de recuperación son cortos: seguí pedaleando suave sin parar.",
      "Es un formato extrapolado del 30/15; sin ensayo propio en ciclistas. Si te cuesta sostenerlo, quedate con menos series.",
    ],
    billat_30_30: [
      "Alternás 30 s a tu potencia en VO2max con 30 s suaves, en 2 series. Mantené el mismo watt en todas las repeticiones.",
      "Si la potencia cae mucho antes de terminar la serie, cortá ahí: la idea es repetir el esfuerzo, no llegar vacío.",
      "Este formato viene de la carrera a pie; en ciclismo no tiene ensayos propios.",
    ],
    hiit_10x2: [
      "Cada intervalo va al 100% de tu potencia en VO2max: son 2 min, así que se puede sostener sin guardar; si en el último no llegás, bajá 5 W en lugar de cortar.",
      "Los 2 min de recuperación son pedaleo suave (~50%), no pares del todo.",
      "Es el mismo concepto del HIIT genuino con intervalos más cortos; no hay ensayos que digan que sea mejor o peor que los de 4 min.",
    ],
    hiit_4min: [
      "Cada intervalo va al 100% de tu potencia en VO2max y dura 4 min: arrancá controlado, el primer minuto no es para ir sobrado.",
      "Los 4 min de recuperación son pedaleo suave (~50%); usalos para bajar la respiración.",
      "Es el mismo concepto del HIIT genuino con intervalos más largos; no hay ensayos que digan que sea mejor o peor que los de 2 min.",
    ],
    ronnestad_5x12: [
      "Es una sesión de choque: 5 series de 12 × (30 s / 15 s), unos 30 min de trabajo. Solo aparece en la semana intensificada.",
      "Arrancá en tu potencia en VO2max y ajustá entre series: si completaste la serie sin caerte, subí 5 W; si no, bajá. El objetivo es aguantar el patrón las 5 series.",
      "Entre series son ~2,5 min suaves. Si la 4ª o la 5ª serie se te cae mucho, cortá ahí y no fuerces: la semana intensificada ya tiene otra sesión de VO2max.",
      "Cuidá el sueño y la comida del día: es de las sesiones que más cuestan.",
    ],
    vo2_piramide: [
      "Los intervalos suben y bajan (por ejemplo 1-2-3-4-3-2-1′): los cortos van un poco más fuertes y los largos algo más suaves, siempre por encima del FTP.",
      "Los 2′ entre intervalos son pedaleo suave: no pares del todo.",
      "No hay ensayos que respalden esta forma: es una variante para variar el estímulo.",
    ],
    sprint_neuro: [
      "Cada sprint dura 10 s: salí desde casi parado, sentado, con resistencia alta, y acelerá al máximo sostenido hasta el final.",
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