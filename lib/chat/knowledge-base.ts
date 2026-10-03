export const KNOWLEDGE_BASE = `
=== BASE DE CONOCIMIENTO CIENTÍFICO (consultar siempre antes de razonar) ===

--- LIBRERÍA DE ENTRENAMIENTO Y SUS PROTOCOLOS EXACTOS ---

HIIT GENUINO (Chicharro & Vicente-Campos, 2018, "HIIT: de la teoría a la práctica"):
- Intensidad: 100% de v/pVO2max (velocidad/potencia asociada al VO2max), no un %FTP genérico
- Duración de intervalo: 2-4min dan %VO2max similar; fuera de ese rango baja el tiempo real en zona.
  Punto de partida práctico: 3min.
- Recuperación: activa al ~50% v/pVO2max, relación 1:1 con la duración del intervalo
- Número de repeticiones: objetivo de ~10min acumulados ≥95% VO2max. Con intervalos de 3min, la
  relación tiempo-en-VO2max/tiempo-total-ejercicio es ~44% → 7 intervalos de 3min es el punto de
  partida estándar (21min ejercicio × 0.44 ≈ 9'14" en zona)
- Calentamiento específico: 10min a umbral láctico + 2 intervalos de 1min a intensidad de
  MLSS/VT2 con 30s de recuperación activa, antes del bloque principal
- Frecuencia: MÁXIMO 1 sesión de HIIT genuino real por semana. Recuperación entre sesiones: 48-72h
- Progresión (cada 4-6 semanas, en este orden): 1) duración 3→4min, 2) repeticiones 7→10,
  3) recuperación 3→2min (la más difícil de lograr)
- Evitar pendiente positiva: con 4-5% de pendiente la relación tiempo-en-VO2max cae de 44% a 27%

SWEET SPOT: 88-94% FTP, 2-3x15-20min. Evidencia MÁS DÉBIL que otros métodos (el rango de Coggan
se originó analizando datos de solo ~12 ciclistas). Útil como herramienta táctica de tiempo
limitado, NO como sustituto de trabajo real de VO2max — sin ese trabajo en paralelo, el techo
aeróbico no sube.

UMBRAL (Seiler LI): 95-105% FTP, ej. 4x8min. Eleva el umbral de lactato.

RØNNESTAD 30/15: ~110-130% FTP, ej. 3 series de 13x(30s/15s). Similar objetivo a HIIT genuino
(VO2max) pero con menor costo neuromuscular por las pausas cortas — buena alternativa cuando
ya se usó el cupo semanal de HIIT genuino.

BILLAT 30-30: 100%/50% vVO2max alternado, series hasta el fallo. El efecto de retraso en el
consumo de O2 permite mantenerse en VO2max real incluso en la fase de "descanso" al 50%.

SIT / RST: >120% supramáximo, esfuerzos muy cortos (4-30s). Objetivo neuromuscular/anaeróbico,
NO equivalente a trabajo de VO2max — no reemplaza HIIT genuino ni Rønnestad para ese fin.

Z2 / BASE: 56-75% FTP. Modelo 80/20 (Seiler): la mayoría del volumen semanal debe ser aquí.

--- CARGA: INTERNA VS EXTERNA ---

- TSS/kJ (Coggan) = carga EXTERNA (trabajo mecánico). Sólido, aprovechado directo de Intervals.icu.
- iTRIMP = carga INTERNA individualizada. Sanders et al. 2017 (ciclistas de ruta): iTRIMP y TSS
  tienen la relación dosis-respuesta MÁS FUERTE con cambios reales de fitness (r=0.81 y r=0.75).
- Ningún marcador aislado de fatiga es confiable — requiere FUSIÓN de: HRV + FC reposo + bienestar
  subjetivo (Alfonso et al. 2025, ciclistas). El estrés subjetivo es el marcador más consistente
  día a día de los tres.
- Desacople Pw:HR: umbral popular de 5% tiene validación académica reciente y limitada (Rothschild/
  Maunder 2025). Por encima de 10% es la señal más fuerte de mala eficiencia aeróbica o fatiga real
  — usar 10% como corte de alerta fuerte, no 5%. SIEMPRE interpretar junto con HRV/HRR/potencia real,
  nunca aislado — está confundido por calor, hidratación y duración de la sesión.
- Deriva cardiovascular normal (cardiovascular drift) ≠ fatiga: es fisiológica, reversible con
  hidratación/enfriamiento. Distinto de la atenuación de la respuesta cronotrópica en overreaching,
  donde la FC para una potencia dada es anómalamente BAJA (no por eficiencia, sino por fatiga del
  sistema autónomo/cardíaco) — para diferenciar: si además CAE la potencia sostenida real, es fatiga;
  si la potencia se mantiene o sube con FC más baja, es adaptación real.

--- PERIODIZACIÓN Y AUTORREGULACIÓN ---

- Entrenamiento guiado por HRV iguala o supera modestamente al plan fijo tradicional en ciclistas
  (Javaloyes et al. 2018/2020), con menos sesiones de alta intensidad para el mismo resultado.
  Beneficio mayor en amateurs que en élite.
- Kiely (2012, 2018): la periodización rígida por bloques carece de fundamento sólido de evidencia;
  la planificación debe ser flexible y responsiva al estado real del atleta, no un plan inamovible.
- Check-in diario tipo Hooper-Mackinnon (sueño, fatiga, estrés, dolor muscular, ánimo, escala 1-7)
  es el estándar de campo por su brevedad — más práctico que cuestionarios largos (DALDA/POMS/RESTQ).
- Taper pre-competencia: 2 semanas, reducción de volumen 41-60%, SIN tocar intensidad ni frecuencia
  (Bosquet 2007). Distinto de deload por fatiga acumulada, que no tiene calendario fijo — se dispara
  por evidencia de marcadores, no por contador de semanas.

--- NUTRICIÓN INTRA-ENTRENO ---

- 1000 kJ de trabajo ≈ 1000 kcal de gasto (la conversión kJ→kcal y la eficiencia mecánica ~22% se
  cancelan matemáticamente)
- Carbohidrato sugerido = 40-50% del gasto en kJ, convertido a kcal, luego a gramos (÷4 kcal/g)
- Techo de absorción por una sola fuente: 60g/h para sesiones de 1-2.5h, hasta 90g/h para sesiones
  más largas (ACSM/ISSN). Por encima de ese techo, requiere fuentes múltiples (glucosa+fructosa)
  para evitar malestar digestivo — SIEMPRE avisar esto si el cálculo lo supera.

--- LÍMITES IMPORTANTES A RECONOCER ---

- El Amazfit del atleta no está validado científicamente contra ECG — confiar en TENDENCIAS propias
  (relativas a su propia línea base), no en el valor absoluto como si fuera clínicamente exacto.
- La calibración de línea base individual necesita ~4 semanas mínimo antes de que los umbrales
  dejen de ser genéricos de la literatura y pasen a ser específicos del atleta.
`;