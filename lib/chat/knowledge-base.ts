import { referencesPrompt } from "./references";

export const KNOWLEDGE_BASE = `
=== BASE DE CONOCIMIENTO CIENTÍFICO ===
Cada afirmación lleva su fuente entre corchetes [R#] (ver BIBLIOGRAFÍA CERRADA al final, con su nivel de
evidencia y cuánto se verificó). Lo marcado [PRÁCTICA] es criterio de entrenadores o decisión de diseño
del sistema SIN estudio que lo respalde directamente: si lo usás, decí explícitamente que es criterio de
práctica y no evidencia. Si algo no está acá, no lo afirmes.

--- LIBRERÍA DE ENTRENAMIENTO Y SUS PROTOCOLOS ---

HIIT GENUINO [R1]:
- Intensidad: 100% de v/pVO2max (velocidad/potencia asociada al VO2max), no un %FTP genérico [R1]
- Duración de intervalo: 2-4min dan %VO2max similar; fuera de ese rango baja el tiempo real en zona.
  Punto de partida: 3min [R1]
- Recuperación: activa al ~50% v/pVO2max, relación 1:1 con la duración del intervalo [R1]
- Número de repeticiones: objetivo de ~10min acumulados ≥95% VO2max. Con intervalos de 3min, la
  relación tiempo-en-VO2max/tiempo-total-ejercicio es ~44% → 7 intervalos de 3min es el punto de
  partida (21min ejercicio × 0.44 ≈ 9'14" en zona) [R1]
- Calentamiento específico: 10min a umbral láctico/VT1 + 2 intervalos de 1min a intensidad de MLSS/VT2 con
  30s de recuperación activa [R1]. La equivalencia de VT1 con ~70-75% del FTP es una aproximación del
  sistema [PRÁCTICA].
- Frecuencia: 1 sesión de HIIT genuino por semana; recuperación entre sesiones 48-72h [R1]
- Progresión (revisar cada 4-6 semanas, en este orden): 1) duración 3→4min, 2) repeticiones 7→10,
  3) recuperación 3→2min (la más difícil de lograr) [R1]. Los propios autores aclaran que NO es un patrón
  oro validado como el mejor.
- Vuelta a la calma: ~15min suaves (70-80% de VT1) [R1]
- Control de la intensidad: potencia (patrón oro) > RPE 18-19 > FC (peor indicador: meseta, deriva,
  sobreestima al inicio) [R1]
- Criterio "7RM" (completar 7 intervalos y no más; si no llega, alargar la recuperación; si le sobra,
  acortarla) [R1]. El sistema todavía NO lo implementa.
- Evitar pendiente positiva: con 4-5% de pendiente la relación tiempo-en-VO2max cae de 44% a 27% [R1]
- Límite: los datos de cinética de VO2 y de tiempo en VO2max del libro vienen sobre todo de CARRERA; en
  bicicleta el tiempo hasta alcanzar el VO2max es mayor [R1]. Extrapolar con cautela.

SWEET SPOT: 88-94% FTP, 2-3x15-20min. [PRÁCTICA] Concepto de entrenadores. En la revisión bibliográfica de
esta base NO se encontró ningún ensayo que lo evalúe directamente. Los estudios que comparan "umbral" contra
polarizado [R24][R25] no usan sweet spot (el grupo "umbral" de R24 tenía 0% de alta intensidad). Útil como
herramienta táctica de tiempo limitado, NO como sustituto de trabajo real de VO2max. Nunca lo presentes como
"demostrado".

UMBRAL: 95-105% FTP, ej. 4x8min. [PRÁCTICA] Los % y la dosis son criterio de práctica. Evidencia comparativa:
en ciclistas, un modelo centrado en umbral produjo menos mejora que uno polarizado [R24][R25], y la revisión en
corredores encontró el entrenamiento de umbral menos eficaz que el piramidal y el polarizado [R8].

RØNNESTAD 30/15 [R2][R3]: 3 series de 13x(30s/15s), 3min entre series. La primera serie se fija en la
potencia asociada al VO2max (PAM, no un %FTP) y luego se ajusta individualmente entre series a la máxima
intensidad sostenible; la recuperación es el 50% de la potencia del intervalo [R2]. En ciclistas de élite,
3 semanas del esquema 30/15 mejoraron más la potencia aeróbica pico y la potencia media en 20 min que
intervalos largos igualados por esfuerzo [R3]; la muestra es muy pequeña (n=9 vs 4): evidencia PRELIMINAR.
Sin PAM medida el sistema usa ~125-130% FTP como aproximación [PRÁCTICA, no es un valor del estudio]. Para
HIIT corto el libro da 100-110% de la PAM [R1]. Objetivo similar al HIIT genuino (VO2max) con menor costo
neuromuscular por las pausas cortas; el sistema ya NO lo usa como segundo estímulo por defecto (ahora es el rodaje
con sprints, ver abajo), pero el atleta puede elegirlo como su sesión semanal de VO2max en Configuración
(HIIT genuino, Rønnestad 30/15 o alternar semanas; HIIT genuino es el sugerido para el objetivo VO2max y alternar es [PRÁCTICA]). La
dosis progresiva de series que usa el sistema (1→3) es [PRÁCTICA].

RODAJE Z2 CON SPRINTS (segundo estímulo semanal del sistema) [R36][R37]: sesión de baja intensidad con sprints de
30 s a máxima potencia (sentado, explosivo), 4 min de recuperación activa entre sprints y 15 min de Z2 entre
series de hasta 3 sprints. El estudio usó 3 series de 3 sprints (9 sprints) [R36]. En 16 ciclistas de élite, hacerlo UNA vez por semana durante 3 semanas de transición (con ~60% menos de
carga) mantuvo el rendimiento en 20 min y la utilización fraccional del VO2max, mientras el grupo sin sprints
bajó; el VO2max no cambió [R36]. Es evidencia PRELIMINAR (n=7 vs 9, 3 semanas, élite, en transición, no en plena
temporada). Los sprints mejoran sobre todo la potencia anaeróbica [R37] y la potencia cae sprint a sprint [R37].
La progresión del sistema de 5 → 7 → 9 sprints (3 sprints en descarga) es [PRÁCTICA]: el estudio solo evaluó la
dosis completa de 9 sprints. La recuperación de 100 W del estudio está escalada a ~33% FTP en el sistema [PRÁCTICA]. La
potencia que muestra el plan para el sprint es un piso de referencia; el esfuerzo es máximo.

FRECUENCIA DE SESIONES DURAS (por qué el sistema pone UN solo VO2max por semana):
- El libro recomienda 1 sesión de HIIT genuino por microciclo y 48-72 h entre sesiones; dice que habitualmente
  no se supera 2 HIT por semana [R1].
- Seiler describe ~20% de las SESIONES como de alta intensidad en atletas bien entrenados [R7].
- Más frecuencia no dio más adaptación en un ECA con adultos moderadamente entrenados (24 sesiones en 3 semanas vs
  en 8 semanas) [R40], pero compara la misma dosis total, no 1 vs 2 por semana.
- Una sola sesión semanal de HIIT produjo adaptación (+13% VO2max, 8 semanas) en jóvenes sin entrenamiento [R41];
  NO es extrapolable a ciclistas entrenados.
- Piramidal y polarizado funcionan por igual en ciclistas entrenados; lo común es mucho volumen bajo VT1 [R39].
- Con gimnasio 2 veces por semana: el entrenamiento concurrente no comprometió hipertrofia ni fuerza máxima; la
  fuerza explosiva se atenuó más en la misma sesión que separada ≥3 h [R38]. No hay un estudio que mida el efecto
  del gimnasio de piernas sobre la sesión dura del día siguiente: decilo así.
- Que el segundo estímulo semanal sea un rodaje con sprints y no un segundo VO2max o un sweet spot es una decisión de
  diseño para limitar la fatiga con gimnasio [PRÁCTICA]; el sweet spot cuesta casi lo mismo que un HIIT en TSS y no
  tiene ensayos que lo respalden (ver arriba).

BILLAT 30-30: método de intervalos cortos alternados descrito en la literatura de carrera [R6]. El esquema
exacto (~100%/~50% de vVO2max, series hasta el fallo) NO se pudo confirmar en el texto de la fuente: tratalo
como [PRÁCTICA] y no atribuyas cifras a Billat. Está extrapolado de carrera a ciclismo.

SIT / RST: esfuerzos muy cortos (4-30s) a intensidad supramáxima. Objetivo neuromuscular/anaeróbico, NO
equivalente a trabajo de VO2max [R1]: no reemplaza HIIT genuino ni Rønnestad para ese fin. El % exacto de
potencia que usa el sistema para RST es [PRÁCTICA].

Z2 / BASE: 56-75% FTP [PRÁCTICA, rango de zonas].

--- DISTRIBUCIÓN DE INTENSIDADES ---

- En atletas de resistencia de élite, ~80% de las SESIONES son de baja intensidad (~2 mM de lactato) y ~20% están
  dominadas por intervalos de alta intensidad [R7]. Ojo: el 80/20 es de sesiones, no de tiempo ni de volumen.
  Seiler no encontró evidencia convincente de que más trabajo de alta intensidad rinda más a largo plazo en
  atletas ya bien entrenados [R7]. Descripción observacional en esquiadores junior: ~75% de sesiones en zona 1
  [R28].
- Ensayos: en ciclistas, 6 semanas de distribución polarizada superaron a un modelo de umbral en contrarreloj de
  40 km y umbral de lactato [R24] (n=12); en 9 semanas (n=48, población mixta) el polarizado logró el mayor aumento
  de VO2peak [R25]; en corredores, más tiempo en zona 1 mejoró más un 10 km simulado [R29] (n=12). Las muestras
  son pequeñas y varias no son ciclistas.
- Una revisión sistemática en corredores encontró el entrenamiento piramidal y el polarizado más eficaces que el
  de umbral [R8]. La cifra "~80% bajo VT1 / ~20% por encima" que cita el libro [R1] no figura en el abstract de
  esa revisión.

--- CARGA Y MONITOREO ---

- TSS/kJ (Coggan) = carga EXTERNA (trabajo mecánico), tomada de Intervals.icu. [PRÁCTICA, métrica estándar]
- En ciclistas (n=15, 10 semanas), las cargas que integran características fisiológicas individuales (iTRIMP,
  luTRIMP) tuvieron las relaciones dosis-respuesta más fuertes; en aptitud submáxima el TSS fue comparable a
  iTRIMP [R11]. Son correlaciones en un grupo pequeño, no garantía individual.
- CTL/ATL/TSB (modelo fitness-fatiga): se usa por convención [PRÁCTICA]. En esta base NO hay fuente leída que
  fije un TSB "óptimo" ni un límite de rampa de CTL: no los presentes como evidencia. Tampoco hay respaldo para
  una "zona segura" de ACWR: la fuente verificada propone descartarlo como marco [R34].
- Ningún marcador aislado de fatiga es confiable [R20]; conviene combinar HRV + FC de reposo + bienestar
  subjetivo [R4][R21][R16]. Evidencia preliminar (R4: 28 ciclistas varones, 40 días, grupos de 8-12). Las
  medidas subjetivas reflejaron la carga con mayor sensibilidad y consistencia que las objetivas [R19].
- HRV: usar promedios de 7 días en vez de valores aislados, que pueden ser engañosos [R5]; promediar mejora la
  validez y se recomiendan al menos 3 registros válidos por semana [R17]. El cambio mínimo relevante se expresa en
  múltiplos del coeficiente de variación [R16]. La línea base de 60 días y el umbral de −0,5·SD que usa el
  sistema son criterio propio [PRÁCTICA]: la literatura leída usa CV (no SD). El HRV en reposo casi no cambia con
  el overreaching [R18]: no lo uses como único criterio para bajar la carga.
- Entrenamiento guiado por HRV: en ciclistas, un grupo guiado por HRV mejoró más que uno tradicional (n=17,
  8 semanas) y frente a bloques el rendimiento final fue similar [R15]. Muestras pequeñas; los metaanálisis lo
  ven prometedor pero heterogéneo. No es una ventaja establecida.
- Check-in diario tipo Hooper (sueño, fatiga, estrés, dolor muscular; escala 1-7, 7 = peor) [R14].
- Overreaching vs síndrome de sobreentrenamiento: difícil de distinguir; antes de atribuir el cansancio a la carga,
  descartar infecciones, déficits nutricionales y baja disponibilidad de energía [R20].
- Desacople Pw:HR: el umbral popular de 5% y el corte de alerta de 10% son heurísticas de campo sin estudio que
  los respalde en esta base [PRÁCTICA]; interpretarlo junto con HRV/FC/potencia (lo confunden calor, hidratación y
  duración).
- Deriva cardiovascular normal ≠ fatiga: es fisiológica y reversible con hidratación/enfriamiento. Criterio de
  diferenciación (si además cae la potencia sostenida es fatiga; si la potencia se mantiene con FC más baja,
  adaptación) [PRÁCTICA].
- Desvío de TSS real vs planeado >25% = posible desvío [PRÁCTICA, umbral del sistema].

--- SUEÑO ---

- La pérdida AGUDA de sueño redujo el rendimiento físico en promedio −7,56% (IC95% −11,9 a −3,13), sobre todo con
  privación total o restricción tardía; las tareas de la mañana casi no se vieron afectadas [R22].
- Consenso de expertos: los atletas de élite suelen dormir <7 h; el efecto de una restricción parcial de 1-3 noches
  sigue sin estar claro; una recomendación única probablemente no sea ideal, individualizar [R23]. No prometas
  cifras de pérdida de rendimiento por una mala noche.

--- PERIODIZACIÓN ---

- Los supuestos de la periodización tradicional no han sido puestos a prueba y las respuestas al entrenamiento
  varían mucho: conviene planificación flexible y adaptada al contexto [R13]. (Kiely no afirma que los bloques
  carezcan de fundamento.)
- Bloques: un metaanálisis encontró un efecto pequeño a favor de la periodización por bloques en VO2max
  (DME 0,40; IC95% 0,02-0,79) y Wmax, con calidad baja de los estudios [R27]; un ensayo en ciclistas (n=19) vio
  mejoras con un bloque de HIT y ninguna con la distribución tradicional [R26].
- Taper pre-competencia: ~2 semanas, reducción exponencial del volumen 41-60% SIN tocar intensidad ni frecuencia
  [R12] (metaanálisis en deportes de resistencia en general). Distinto de deload por fatiga acumulada, que no tiene
  calendario fijo: se dispara por evidencia de marcadores. La estructura de deload 3:1 o 4:1 es [PRÁCTICA].

--- FUERZA ---

- En ciclismo, el entrenamiento de fuerza pesada combinado con resistencia fue el de mayor beneficio sobre la
  economía; los efectos sobre el umbral de lactato fueron mixtos; sumar fuerza no perjudica la resistencia
  [R35] (revisión narrativa). La dosis semanal de gimnasio que usa el sistema es [PRÁCTICA].

--- NUTRICIÓN INTRA-ENTRENO ---

- 1000 kJ de trabajo ≈ 1000 kcal de gasto (la conversión kJ→kcal y la eficiencia mecánica ~22% se cancelan
  matemáticamente).
- Carbohidrato durante el ejercicio [R10]: ≤45 min no hace falta; 45-75 min cantidades pequeñas (incl. enjuague
  bucal); 1-2,5 h 30-60 g/h; ≥2,5-3 h hasta 90 g/h. Jeukendrup coincide en ~60 g/h para 2-3 h y ~90 g/h en
  ultrarresistencia, y en que un enjuague bucal puede bastar en ejercicio de ~30 min a 1 h [R9]. Los valores
  puntuales que el sistema elige dentro de esos rangos (por ejemplo ~15 g/h en sesiones intensas de 45-75 min)
  son decisiones de diseño [PRÁCTICA].
- Una sola fuente se oxida hasta ~60 g/h; por encima se necesitan carbohidratos de transportadores múltiples
  (mezclas glucosa:fructosa) [R9][R10]. Una proporción cercana a 1:0,8 podría ser mejor que 2:1 [R30]. No
  superar 90 g/h. SIEMPRE avisar si se supera ~60 g/h.
- Entrenamiento del intestino: ~2 semanas de ingesta repetida de carbohidrato redujeron el malestar intestinal
  en promedio 47% (2 estudios, evidencia moderada-baja) [R31].
- "Train low" / restricción periodizada de carbohidrato: sin efecto global sobre el rendimiento en atletas muy
  entrenados (DME 0,17; IC95% −0,15 a 0,49) [R32]; utilidad limitada [R30]; marco teórico en [R33]. No lo
  presentes como mejora de rendimiento.

--- LÍMITES IMPORTANTES A RECONOCER ---

- El Amazfit del atleta no está validado científicamente contra ECG: confiar en TENDENCIAS propias (relativas a su
  línea base), no en el valor absoluto.
- La línea base individual necesita varias semanas antes de que los umbrales dejen de ser genéricos [PRÁCTICA].

${referencesPrompt()}
`;
