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
      "Es un rodaje suave con 3 sprints de 30 s a máxima potencia por serie: el resto de la salida es Z2 de verdad, conversando.",
      "Cada sprint es explosivo y sentado, arrancando a ~80 rpm y con resistencia alta; la potencia va a caer en el 2º y 3º (es normal). El número del plan es solo un piso de referencia: el esfuerzo es máximo y suele superarlo.",
      "Los 4 min entre sprints son suaves (~100 W): recuperá casi por completo antes del siguiente.",
      "Si el gimnasio del día anterior te dejó las piernas cargadas o te sentís mal, hacelo como Z2 puro y salteá los sprints.",
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