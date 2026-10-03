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
      "Los 15s de recuperación son cortos a propósito — no bajes del todo la cadencia, mantenés el pedaleo suave.",
      "Es normal sentir acumulación fuerte hacia la serie 2-3, el objetivo es aguantar el patrón, no ir sobrado al principio.",
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