import { referencesPrompt } from "./references";

export const KNOWLEDGE_BASE = `
=== BASE DE CONOCIMIENTO CIENTÍFICO ===
Cada afirmación lleva su fuente entre corchetes [R#] (ver BIBLIOGRAFÍA CERRADA al final). Lo marcado
[PRÁCTICA] es criterio de entrenadores o decisión de diseño del sistema SIN estudio que lo respalde
directamente: si lo usás, decí explícitamente que es criterio de práctica y no evidencia.

--- LIBRERÍA DE ENTRENAMIENTO Y SUS PROTOCOLOS EXACTOS ---

HIIT GENUINO [R1]:
- Intensidad: 100% de v/pVO2max (velocidad/potencia asociada al VO2max), no un %FTP genérico [R1]
- Duración de intervalo: 2-4min dan %VO2max similar; fuera de ese rango baja el tiempo real en zona.
  Punto de partida: 3min [R1]
- Recuperación: activa al ~50% v/pVO2max, relación 1:1 con la duración del intervalo [R1]
- Número de repeticiones: objetivo de ~10min acumulados ≥95% VO2max. Con intervalos de 3min, la
  relación tiempo-en-VO2max/tiempo-total-ejercicio es ~44% → 7 intervalos de 3min es el punto de
  partida (21min ejercicio × 0.44 ≈ 9'14" en zona) [R1]
- Calentamiento específico: 10min a umbral láctico/VT1 (~70-75% FTP, NO a MLSS) + 2 intervalos de 1min a
  intensidad de MLSS/VT2 con 30s de recuperación activa [R1]. El % del FTP que equivale a VT1 es una
  aproximación del sistema [PRÁCTICA].
- Frecuencia: 1 sesión de HIIT genuino por semana; recuperación entre sesiones 48-72h [R1]
- Progresión (revisar cada 4-6 semanas, en este orden): 1) duración 3→4min, 2) repeticiones 7→10,
  3) recuperación 3→2min (la más difícil de lograr) [R1]. Los autores aclaran que NO es un patrón oro
  validado como el mejor.
- Vuelta a la calma: ~15min suaves (70-80% de VT1) [R1]
- Control de la intensidad: potencia (patrón oro) > RPE 18-19 > FC (peor indicador: meseta, deriva,
  sobreestima al inicio) [R1]
- Criterio "7RM" (completar 7 intervalos y no más; si no llega, alargar la recuperación; si le sobra,
  acortarla) [R1]. El sistema todavía NO lo implementa.
- Evitar pendiente positiva: con 4-5% de pendiente la relación tiempo-en-VO2max cae de 44% a 27% [R1]
- Límite: los datos de cinética de VO2 y de tiempo en VO2max del libro vienen sobre todo de CARRERA; en
  bicicleta el tiempo hasta alcanzar el VO2max es mayor [R1]. Extrapolar con cautela.

SWEET SPOT: 88-94% FTP, 2-3x15-20min. [PRÁCTICA] Concepto de entrenadores con poca investigación
directa: evidencia MÁS DÉBIL que otros métodos. Útil como herramienta táctica de tiempo limitado, NO
como sustituto de trabajo real de VO2max. Nunca presentes un beneficio de sweet spot como "demostrado".

UMBRAL: 95-105% FTP, ej. 4x8min. [PRÁCTICA] Se usa para trabajar cerca del umbral de lactato; no hay en
esta base un estudio que fije esos porcentajes ni esa dosis.

RØNNESTAD 30/15 [R2][R3]: 3 series de 13x(30s/15s), 3min entre series. La primera serie se fija en la
potencia asociada al VO2max (PAM, no un %FTP) y luego se ajusta individualmente entre series a la máxima
intensidad sostenible; la recuperación es el 50% de la potencia del intervalo [R2]. Sin PAM medida el
sistema usa ~125-130% FTP como aproximación [PRÁCTICA, no es un valor del estudio]. Para HIIT corto el
libro da 100-110% de la PAM [R1]. Objetivo similar al HIIT genuino (VO2max) con menor costo neuromuscular
por las pausas cortas; alternativa cuando ya se usó el cupo semanal de HIIT genuino. Los ensayos son en
ciclistas, con muestras pequeñas.

BILLAT 30-30 [R6]: alterna ~100% y ~50% de vVO2max, series hasta el fallo. Es un método descripto para
carrera y extrapolado a ciclismo. La explicación fisiológica (retraso del VO2 que mantiene el consumo alto
en la fase "de descanso") es interpretación del autor, no un hallazgo medido en este sistema.

SIT / RST: esfuerzos muy cortos (4-30s) a intensidad supramáxima. Objetivo neuromuscular/anaeróbico, NO
equivalente a trabajo de VO2max [R1]: no reemplaza HIIT genuino ni Rønnestad para ese fin. El % exacto de
potencia que usa el sistema para RST es [PRÁCTICA].

Z2 / BASE: 56-75% FTP [PRÁCTICA, rango de zonas]. Modelo ~80/20: la mayoría del volumen semanal en baja
intensidad [R7]; en corredores de media y larga distancia ~80% bajo VT1 y ~20% por encima [R8].

--- CARGA: INTERNA VS EXTERNA ---

- TSS/kJ (Coggan) = carga EXTERNA (trabajo mecánico), tomada de Intervals.icu. [PRÁCTICA, métrica estándar]
- iTRIMP = carga INTERNA individualizada. En ciclistas de ruta las cargas internas (iTRIMP/luTRIMP)
  mostraron la relación dosis-respuesta más fuerte con cambios de rendimiento; el TSS también se asoció,
  algo menos [R11]. Son correlaciones en un grupo pequeño, no garantía individual.
- Ningún marcador aislado de fatiga es confiable: conviene FUSIONAR HRV + FC de reposo + bienestar
  subjetivo [R4]. Evidencia preliminar (28 ciclistas varones, 40 días, grupos de 8-12): no la presentes
  como concluyente.
- Desacople Pw:HR: el umbral popular de 5% tiene validación académica limitada; usar 10% como corte de
  alerta fuerte [PRÁCTICA, heurística de campo no validada]. Interpretarlo siempre junto con HRV/FC/potencia,
  nunca aislado (lo confunden calor, hidratación y duración).
- Deriva cardiovascular normal ≠ fatiga: es fisiológica y reversible con hidratación/enfriamiento. Si
  además de FC anómalamente baja para una potencia dada CAE la potencia sostenida real, es fatiga; si la
  potencia se mantiene o sube con FC más baja, es adaptación. [PRÁCTICA, criterio de diferenciación]
- Desvío de TSS real vs planeado >25% = posible desvío [PRÁCTICA, umbral del sistema].

--- PERIODIZACIÓN Y AUTORREGULACIÓN ---

- Entrenamiento guiado por HRV: en ciclistas dio resultados similares o algo mejores que el plan fijo con
  menos sesiones de alta intensidad [R15]; los metaanálisis lo ven prometedor pero con evidencia
  heterogénea y de calidad limitada. No es una ventaja establecida.
- HRV: se interpreta con LnRMSSD frente a la línea base propia (~60 días) y la media de 7 días [R5]; un
  valor aislado de un día no es una señal confiable. El umbral de −0.5·SD que usa el sistema es [PRÁCTICA].
- La periodización rígida por bloques carece de fundamento sólido; la planificación debe ser flexible y
  responsiva al estado real del atleta [R13].
- Check-in diario tipo Hooper (sueño, fatiga, estrés, dolor muscular; escala 1-7) es el estándar de campo
  por su brevedad [R14].
- Taper pre-competencia: ~2 semanas, reducción de volumen 41-60% SIN tocar intensidad ni frecuencia [R12].
  Distinto de deload por fatiga acumulada, que no tiene calendario fijo: se dispara por evidencia de
  marcadores. La estructura de deload 3:1 o 4:1 es [PRÁCTICA] (no hay estudio que la fije).

--- NUTRICIÓN INTRA-ENTRENO ---

- 1000 kJ de trabajo ≈ 1000 kcal de gasto (la conversión kJ→kcal y la eficiencia mecánica ~22% se
  cancelan matemáticamente).
- Carbohidrato durante el ejercicio según duración [R9][R10]: <45 min ~0 g/h; 1-2 h ~30 g/h; 2-3 h ~60 g/h;
  >2.5 h hasta 90 g/h. Los tramos intermedios que usa el sistema (p. ej. ~15 g/h para 45-75 min si es
  intensa, 45-60 g/h en 1-2 h intensas, 60-75 g/h en 2.5-3 h) son interpolaciones del sistema [PRÁCTICA].
- Una sola fuente (glucosa/maltodextrina) se satura en ~60 g/h; por encima se necesita mezcla
  glucosa:fructosa y entrenar el intestino [R9]. SIEMPRE avisar si se supera.

--- LÍMITES IMPORTANTES A RECONOCER ---

- El Amazfit del atleta no está validado científicamente contra ECG: confiar en TENDENCIAS propias
  (relativas a su línea base), no en el valor absoluto.
- La línea base individual necesita ~4 semanas mínimo antes de que los umbrales dejen de ser genéricos.

${referencesPrompt()}
`;
