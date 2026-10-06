/**
 * Bibliografía cerrada del asistente. Es la ÚNICA fuente que el chat puede citar.
 * - level: qué tipo de evidencia es (para que el asistente no la presente con más certeza de la que tiene)
 * - checked (cuánto se verificó, al 2026-10-05):
 *     "fuente"   = texto/tabla leída en la fuente original o su copia
 *     "abstract" = cita y abstract/metadatos verificados; el texto completo no se leyó
 *     "cita"     = la cita existe, pero NO se confirmó en el texto lo que se le atribuye
 *     "resumen"  = a partir del resumen del libro que subió el entrenador
 */
export interface Reference {
  id: string;
  surnames: string[]; // para el control automático de citas
  cite: string;
  supports: string;
  level: string;
  checked: "fuente" | "abstract" | "cita" | "resumen";
}

export const REFERENCES: Reference[] = [
  // ── HIIT / diseño de intervalos ─────────────────────────────────────────────
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
    surnames: ["Rønnestad", "Ronnestad", "Hansen", "Nygaard", "Lundby"],
    cite: "Rønnestad BR, Hansen J, Nygaard H, Lundby C. Superior performance improvements in elite cyclists following short-interval vs effort-matched long-interval training. Scand J Med Sci Sports. 2020;30(5):849-857. doi:10.1111/sms.13627.",
    supports: "Ciclistas de élite (VO2max 73±4), 3 semanas, 3 sesiones/semana: intervalos cortos (3×13×30 s/15 s, 3 min entre series; n=9) vs largos (4×5 min; n=4), igualados por esfuerzo percibido. Potencia aeróbica pico +3,7±4,3% vs −0,3±2,8%; potencia media en 20 min +4,7±4,4% vs −1,4±2,2%.",
    level: "Muestra muy pequeña y desbalanceada (13 en total): evidencia PRELIMINAR. La intensidad de la recuperación al 50% no figura en el abstract (viene de R2).",
    checked: "abstract",
  },
  {
    id: "R6",
    surnames: ["Billat"],
    cite: "Billat LV. Interval training for performance: a scientific and empirical practice. Special recommendations for middle- and long-distance running. Part I: aerobic interval training. Sports Med. 2001;31(1):13-31. doi:10.2165/00007256-200131010-00002.",
    supports: "Revisión histórica de entrenamiento interválico aeróbico (carrera). NO se confirmó en el texto el esquema 30-30 al ~100%/~50% de vVO2max: no atribuyas esa precisión a esta fuente.",
    level: "Revisión (carrera a pie), extrapolada a ciclismo.",
    checked: "cita",
  },
  {
    id: "R24",
    surnames: ["Neal"],
    cite: "Neal CM, et al. Six weeks of a polarized training-intensity distribution leads to greater physiological and performance adaptations than a threshold model in trained cyclists. J Appl Physiol. 2013;114(4):461-471. doi:10.1152/japplphysiol.00652.2012.",
    supports: "Ciclistas: polarizado (80/0/20%) vs umbral (57/43/0%) durante 6 semanas; mayor mejora en contrarreloj de 40 km y en umbral de lactato con el polarizado.",
    level: "Cruzado, 12 ciclistas varones. El grupo 'umbral' tenía 0% de alta intensidad: NO equivale al sweet spot.",
    checked: "abstract",
  },
  {
    id: "R25",
    surnames: ["Stöggl", "Stoggl", "Sperlich"],
    cite: "Stöggl T, Sperlich B. Polarized training has greater impact on key endurance variables than threshold, high intensity, or high volume training. Front Physiol. 2014;5:33. doi:10.3389/fphys.2014.00033.",
    supports: "ECA de 9 semanas (n=48): el polarizado logró el mayor aumento de VO2peak (+11,7%), tiempo hasta el agotamiento (+17,4%) y potencia/velocidad pico (+5,1%).",
    level: "ECA, población mixta (corredores, ciclistas, triatletas, esquiadores).",
    checked: "abstract",
  },
  {
    id: "R26",
    surnames: ["Ellefsen"],
    cite: "Rønnestad BR, Hansen J, Ellefsen S. Block periodization of high-intensity aerobic intervals provides superior training effects in trained cyclists. Scand J Med Sci Sports. 2014;24(1):34-42. doi:10.1111/j.1600-0838.2012.01485.x.",
    supports: "Bloque de HIT (5 sesiones en la semana 1, luego 1 por semana) vs distribución tradicional en ciclistas entrenados: el grupo de bloques mejoró, el tradicional no cambió.",
    level: "n=19, muestra pequeña.",
    checked: "abstract",
  },
  {
    id: "R27",
    surnames: ["Mølmen", "Molmen"],
    cite: "Mølmen KS, Øfsteng SJ, Rønnestad BR. Block periodization of endurance training: a systematic review and meta-analysis. Open Access J Sports Med. 2019;10:145-160. doi:10.2147/OAJSM.S180408.",
    supports: "Efecto pequeño a favor de la periodización por bloques: VO2max DME 0,40 (IC95% 0,02-0,79); Wmax 0,28 (IC95% 0,01-0,54).",
    level: "Revisión sistemática y metaanálisis (6 estudios), calidad baja (PEDro medio 3,7/10).",
    checked: "abstract",
  },
  // ── Distribución de intensidades / periodización ────────────────────────────
  {
    id: "R7",
    surnames: ["Seiler"],
    cite: "Seiler S. What is best practice for training intensity and duration distribution in endurance athletes? Int J Sports Physiol Perform. 2010;5(3):276-291. doi:10.1123/ijspp.5.3.276.",
    supports: "~80% de las SESIONES a baja intensidad (~2 mM de lactato) y ~20% dominadas por intervalos de alta intensidad cerca del 90% del VO2max; no hay evidencia convincente de que más trabajo de alta intensidad mejore el rendimiento a largo plazo en atletas ya bien entrenados.",
    level: "Revisión con datos observacionales de atletas de élite. El 80/20 es de SESIONES, no de volumen/tiempo.",
    checked: "abstract",
  },
  {
    id: "R28",
    surnames: ["Kjerland"],
    cite: "Seiler KS, Kjerland GØ. Quantifying training intensity distribution in elite endurance athletes: is there evidence for an \"optimal\" distribution? Scand J Med Sci Sports. 2006;16(1):49-56. doi:10.1111/j.1600-0838.2004.00418.x.",
    supports: "Esquiadores de fondo junior: ~75% de las sesiones en zona 1, 6-8% en zona 2 y 17-18% en zona 3 (distribución polarizada).",
    level: "Observacional, 11 esquiadores junior, 32 días: descriptivo, no en ciclistas.",
    checked: "abstract",
  },
  {
    id: "R29",
    surnames: ["Esteve-Lanao", "Esteve"],
    cite: "Esteve-Lanao J, Foster C, Seiler S, Lucia A. Impact of training intensity distribution on performance in endurance athletes. J Strength Cond Res. 2007;21(3):943-949.",
    supports: "ECA de 5 meses en corredores subélite de 5000 m: más tiempo en zona 1 (80,5% vs 66,8%) mejoró más el tiempo en una carrera simulada de 10,4 km.",
    level: "n=12 corredores: muestra pequeña, no en ciclistas. Las páginas exactas no se confirmaron.",
    checked: "abstract",
  },
  {
    id: "R8",
    surnames: ["Kenneally", "Casado", "Santos-Concejero"],
    cite: "Kenneally M, Casado A, Santos-Concejero J. The effect of periodization and training intensity distribution on middle- and long-distance running performance: a systematic review. Int J Sports Physiol Perform. 2018;13(9):1114-1121. doi:10.1123/ijspp.2017-0327.",
    supports: "Revisión de 16 estudios: el entrenamiento piramidal y el polarizado fueron más eficaces que el de umbral. La cifra '~80% bajo VT1 / ~20% por encima' que el libro (R1) le atribuye NO aparece en el abstract.",
    level: "Revisión sistemática en corredores, no en ciclistas.",
    checked: "abstract",
  },
  {
    id: "R12",
    surnames: ["Bosquet", "Montpetit", "Arvisais", "Mujika"],
    cite: "Bosquet L, Montpetit J, Arvisais D, Mujika I. Effects of tapering on performance: a meta-analysis. Med Sci Sports Exerc. 2007;39(8):1358-1365. doi:10.1249/mss.0b013e31806010e0.",
    supports: "Taper óptimo de 2 semanas con reducción exponencial del volumen de 41-60% SIN modificar intensidad ni frecuencia (efecto 0,59±0,33).",
    level: "Metaanálisis (27 de 182 estudios) en deportes de resistencia en general, no específico de ciclismo.",
    checked: "abstract",
  },
  {
    id: "R13",
    surnames: ["Kiely"],
    cite: "Kiely J. Periodization paradigms in the 21st century: evidence-led or tradition-driven? Int J Sports Physiol Perform. 2012;7(3):242-250; y Kiely J. Periodization theory: confronting an inconvenient truth. Sports Med. 2018;48(4):753-764. doi:10.1007/s40279-017-0823-y.",
    supports: "Crítica a la teoría de periodización tradicional (sus supuestos no han sido puestos a prueba); las respuestas al entrenamiento varían mucho y conviene planificación flexible y adaptada al contexto. NO afirma específicamente que los bloques tengan poco fundamento.",
    level: "Revisiones críticas / posición de un autor.",
    checked: "abstract",
  },
  // ── Monitoreo, HRV, fatiga ──────────────────────────────────────────────────
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
    surnames: ["Plews", "Laursen", "Stanley", "Kilding"],
    cite: "Plews DJ, Laursen PB, Stanley J, Kilding AE, Buchheit M. Training adaptation and heart rate variability in elite endurance athletes: opening the door to effective monitoring. Sports Med. 2013;43(9):773-781. doi:10.1007/s40279-013-0071-8.",
    supports: "Los promedios semanales y de 7 días tienen mejor validez metodológica que un valor de un solo día; con valores de un día el HRV puede ser engañoso (reducciones 'relevantes' aparecieron cuando el atleta entrenaba y rendía bien).",
    level: "Estudios de caso y series en atletas de élite. La línea base de 60 días y el umbral de −0,5·SD del sistema NO vienen de esta fuente: son criterio propio [PRÁCTICA].",
    checked: "fuente",
  },
  {
    id: "R17",
    surnames: [],
    cite: "Plews DJ, Laursen PB, Kilding AE, Buchheit M. Monitoring training with heart-rate variability: how much compliance is needed for valid assessment? Int J Sports Physiol Perform. 2014;9(5).",
    supports: "Promediar de 1 a 7 días aumenta los cambios estandarizados de LnRMSSD; recomiendan un mínimo de 3 registros válidos por semana.",
    level: "Observacional en atletas. Solo se leyó el abstract.",
    checked: "abstract",
  },
  {
    id: "R16",
    surnames: ["Buchheit"],
    cite: "Buchheit M. Monitoring training status with HR measures: do all roads lead to Rome? Front Physiol. 2014;5:73. doi:10.3389/fphys.2014.00073.",
    supports: "Las mediciones casi diarias de HRV en reposo y de FC submáxima son las herramientas más útiles; interpretarlas según el error de medición, el cambio mínimo relevante y el contexto, y combinarlas con diarios, cuestionarios psicométricos y salto. El cambio mínimo relevante se expresa en múltiplos del coeficiente de variación (CV), no de la desviación estándar.",
    level: "Revisión narrativa.",
    checked: "fuente",
  },
  {
    id: "R18",
    surnames: ["Bellenger"],
    cite: "Bellenger CR, et al. Monitoring athletic training status through autonomic heart rate regulation: a systematic review and meta-analysis. Sports Med. 2016;46(10):1461-1486. doi:10.1007/s40279-016-0484-2.",
    supports: "27 estudios (24 en metaanálisis): el RMSSD en reposo sube con la mejora de rendimiento (DME 0,58) y casi no cambia con el overreaching (DME 0,26): el HRV en reposo 'está en gran medida sin afectar' por el overreaching. Usarlo con cautela, nunca como único criterio.",
    level: "Revisión sistemática y metaanálisis en atletas de resistencia.",
    checked: "abstract",
  },
  {
    id: "R19",
    surnames: ["Saw", "Main", "Gastin"],
    cite: "Saw AE, Main LC, Gastin PB. Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures: a systematic review. Br J Sports Med. 2016;50(5):281-291. doi:10.1136/bjsports-2015-094758.",
    supports: "56 estudios: las medidas subjetivas reflejaron la carga aguda y crónica con mayor sensibilidad y consistencia que las objetivas; ambas generalmente no correlacionaron entre sí.",
    level: "Revisión sistemática.",
    checked: "abstract",
  },
  {
    id: "R20",
    surnames: ["Meeusen"],
    cite: "Meeusen R, et al. Prevention, diagnosis, and treatment of the overtraining syndrome: joint consensus statement of the ECSS and ACSM. Med Sci Sports Exerc. 2013;45(1):186-205. doi:10.1249/MSS.0b013e318279a10a.",
    supports: "Distinguir overreaching no funcional de síndrome de sobreentrenamiento es difícil; ningún marcador único satisface todos los requisitos clínicos; hay que descartar infecciones, déficits nutricionales y baja disponibilidad de energía.",
    level: "Consenso de expertos (ECSS/ACSM).",
    checked: "abstract",
  },
  {
    id: "R21",
    surnames: ["Halson"],
    cite: "Halson SL. Monitoring training load to understand fatigue in athletes. Sports Med. 2014;44(Suppl 2):139-147. doi:10.1007/s40279-014-0253-z.",
    supports: "Respalda combinar marcadores (objetivos y subjetivos) e individualizar la interpretación.",
    level: "Revisión narrativa.",
    checked: "abstract",
  },
  {
    id: "R14",
    surnames: ["Hooper", "Mackinnon"],
    cite: "Hooper SL, Mackinnon LT. Monitoring overtraining in athletes. Sports Med. 1995;20(5):321-327. La escala de 1-7 de sueño, fatiga, estrés y dolor muscular proviene de Hooper SL, MacKinnon LT, et al. Markers for monitoring overtraining and recovery. Med Sci Sports Exerc. 1995;27:106-112 (visto solo en una fuente secundaria).",
    supports: "Origen del 'índice de Hooper': check-in breve de sueño, fatiga, estrés y dolor muscular puntuados de 1 a 7 (7 = peor).",
    level: "Herramienta de campo. No se leyó el abstract de ninguno de los dos artículos.",
    checked: "cita",
  },
  {
    id: "R11",
    surnames: ["Sanders", "Abt", "Hesselink", "Myers", "Akubat"],
    cite: "Sanders D, Abt G, Hesselink MKC, Myers T, Akubat I. Methods of monitoring training load and their relationships to changes in fitness and performance in competitive road cyclists. Int J Sports Physiol Perform. 2017;12(5):668-675. doi:10.1123/ijspp.2016-0454.",
    supports: "n=15 ciclistas, 10 semanas de pretemporada. Aptitud submáxima (potencia a 2 y 4 mmol/L): iTRIMP r=0,81 y 0,77; TSS r=0,75 y 0,79. Contrarreloj de 8 min: iTRIMP r=0,63; luTRIMP r=0,70. Los métodos que integran características fisiológicas individuales tuvieron las relaciones dosis-respuesta más fuertes.",
    level: "Observacional, 15 ciclistas, intervalos de confianza amplios: correlación, no garantía individual. En aptitud submáxima el TSS fue comparable a iTRIMP.",
    checked: "abstract",
  },
  {
    id: "R15",
    surnames: ["Javaloyes", "Sarabia", "Lamberts", "Moya-Ramon"],
    cite: "Javaloyes A, Sarabia JM, Lamberts RP, Moya-Ramon M. Training prescription guided by heart-rate variability in cycling. Int J Sports Physiol Perform. 2019;14(1):23-32. doi:10.1123/ijspp.2018-0122; y Javaloyes A, Sarabia JM, Lamberts RP, Plews D, Moya-Ramon M. Training prescription guided by heart rate variability vs. block periodization in well-trained cyclists. J Strength Cond Res. 2020;34(6):1511-1518. doi:10.1519/JSC.0000000000003337.",
    supports: "2019 (n=17, 8 semanas): el grupo guiado por HRV mejoró potencia pico +5,1%, potencia en VT2 +13,9% y contrarreloj de 40 min +7,3%; el grupo tradicional no tuvo mejoras significativas. 2020: entre grupos, el rendimiento fue similar (el de HRV mejoró más variables que el de bloques, pero 'between-group fitness and performance were similar'). NO se confirmó que el grupo HRV hiciera menos sesiones de alta intensidad.",
    level: "Ensayos pequeños (n=17 y 20 al inicio). Los metaanálisis ven la guía por HRV como prometedora pero heterogénea.",
    checked: "fuente",
  },
  {
    id: "R22",
    surnames: ["Craven"],
    cite: "Craven J, et al. Effects of acute sleep loss on physical performance: a systematic and meta-analytical review. Sports Med. 2022;52:2669-2690. doi:10.1007/s40279-022-01706-y.",
    supports: "69 publicaciones: la pérdida aguda de sueño redujo el rendimiento en promedio −7,56% (IC95% −11,9 a −3,13); consistente con privación total y restricción tardía, no con restricción temprana; tareas de la mañana 'largely unaffected'.",
    level: "Revisión sistemática y metaanálisis (mayormente pérdida AGUDA de sueño).",
    checked: "fuente",
  },
  {
    id: "R23",
    surnames: ["Walsh"],
    cite: "Walsh NP, Halson SL, et al. Sleep and the athlete: narrative review and 2021 expert consensus recommendations. Br J Sports Med. 2021;55(7):356.",
    supports: "Los atletas de élite suelen dormir poco (<7 h) y mal; una o más noches sin dormir reducen el rendimiento; el efecto de una restricción parcial de 1-3 noches 'sigue sin estar claro'; una recomendación única (p. ej. 7-9 h) probablemente no sea ideal: individualizar.",
    level: "Consenso de expertos y revisión narrativa. El DOI no se verificó.",
    checked: "abstract",
  },
  {
    id: "R34",
    surnames: ["Impellizzeri"],
    cite: "Impellizzeri FM, Woodcock S, Coutts AJ, Fanchini M, McCall A, Vigotsky AD. What role do chronic workloads play in the acute to chronic workload ratio? Time to dismiss ACWR and its underlying theory. Sports Med. 2021;51(3):581-592. doi:10.1007/s40279-020-01378-6.",
    supports: "El ACWR no mejora un modelo base para predecir lesión (c = 0,574 vs 0,5) y los autores proponen descartarlo como marco. No hay respaldo para usar una 'zona segura' de ACWR (p. ej. 0,8-1,3) como regla dura.",
    level: "Reanálisis estadístico de datos publicados, deportes de equipo; no es ciclismo.",
    checked: "abstract",
  },
  // ── Fuerza ──────────────────────────────────────────────────────────────────
  {
    id: "R35",
    surnames: [],
    cite: "Rønnestad BR, Mujika I. Optimizing strength training for running and cycling endurance performance: a review. Scand J Med Sci Sports. 2014;24(4):603-612. doi:10.1111/sms.12104.",
    supports: "En ciclismo, el entrenamiento de fuerza pesada combinado con resistencia fue el de mayor beneficio sobre la economía; los efectos sobre el umbral de lactato fueron mixtos; sumar fuerza no perjudica la resistencia.",
    level: "Revisión narrativa, sin cifras en el abstract.",
    checked: "abstract",
  },
  // ── Nutrición ───────────────────────────────────────────────────────────────
  {
    id: "R9",
    surnames: ["Jeukendrup"],
    cite: "Jeukendrup AE. A step towards personalized sports nutrition: carbohydrate intake during exercise. Sports Med. 2014;44(Suppl 1):S25-S33. doi:10.1007/s40279-014-0148-z.",
    supports: "Una sola fuente de carbohidrato se oxida hasta ~60 g/h (recomendación para ejercicio prolongado, 2-3 h); en eventos de ultrarresistencia ~90 g/h, que exige carbohidratos de transportadores múltiples; en ejercicio de ~30 min a 1 h no hace falta ingerir mucho y un enjuague bucal puede bastar. La dosis exacta para 1-2 h NO se confirmó.",
    level: "Revisión narrativa de expertos.",
    checked: "abstract",
  },
  {
    id: "R10",
    surnames: ["ACSM", "Thomas", "Erdman", "Burke"],
    cite: "Thomas DT, Erdman KA, Burke LM. Position of the Academy of Nutrition and Dietetics, Dietitians of Canada, and the American College of Sports Medicine: Nutrition and athletic performance. Med Sci Sports Exerc. 2016;48(3):543-568. doi:10.1249/MSS.0000000000000852 (también J Acad Nutr Diet. 2016;116:501-528).",
    supports: "Carbohidrato durante el ejercicio (Tabla 2): ≤45 min no hace falta; 45-75 min cantidades pequeñas incl. enjuague bucal; 1-2,5 h 30-60 g/h; ≥2,5-3 h hasta 90 g/h; para dosis altas, productos con múltiples carbohidratos transportables (mezclas glucosa:fructosa).",
    level: "Consenso de expertos (posicionamiento oficial).",
    checked: "fuente",
  },
  {
    id: "R30",
    surnames: ["Podlogar", "Wallis"],
    cite: "Podlogar T, Wallis GA. New horizons in carbohydrate research and application for endurance athletes. Sports Med. 2022;52:5-23. doi:10.1007/s40279-022-01757-1.",
    supports: "Hasta 60 g/h en sesiones de hasta 3 h; 60-90 g/h en más de 2,5 h; las recomendaciones actuales no aconsejan superar 90 g/h; una proporción cercana a 1:0,8 glucosa:fructosa podría ser mejor que 2:1; sobre 'train low', la evidencia total sugiere utilidad limitada para mejorar el rendimiento.",
    level: "Revisión narrativa.",
    checked: "fuente",
  },
  {
    id: "R31",
    surnames: ["Martinez", "Mika", "Biesiekierski", "Costa"],
    cite: "Martinez IG, Mika AS, Biesiekierski JR, Costa RJS. The effect of gut-training and feeding-challenge on markers of gastrointestinal status in response to endurance exercise: a systematic literature review. Sports Med. 2023;53(6):1175-1200. doi:10.1007/s40279-023-01841-0.",
    supports: "8 estudios (4-28 días): con ~2 semanas de ingesta repetida de carbohidrato, el malestar intestinal bajó en promedio 47% (2 estudios) y la malabsorción de carbohidrato 45-54% (2 estudios); mejora de síntomas significativa en 2 estudios y poco clara en 4.",
    level: "Revisión sistemática con pocos estudios heterogéneos: evidencia moderada-baja.",
    checked: "abstract",
  },
  {
    id: "R32",
    surnames: ["Gejl", "Nybo"],
    cite: "Gejl KD, Nybo L. Performance effects of periodized carbohydrate restriction in endurance trained athletes: a systematic review and meta-analysis. J Int Soc Sports Nutr. 2021;18:37.",
    supports: "9 estudios en atletas muy entrenados: la restricción periodizada de carbohidrato no tuvo efecto global sobre el rendimiento (DME 0,17; IC95% −0,15 a 0,49; p=0,29). 'Train low' no debe presentarse como mejora de rendimiento.",
    level: "Metaanálisis con pocos estudios. El DOI no se pudo confirmar (dos valores distintos).",
    checked: "abstract",
  },
  {
    id: "R33",
    surnames: ["Impey", "Hearris", "Morton"],
    cite: "Impey SG, Hearris MA, Hammond KM, Bartlett JD, Louis J, Close GL, Morton JP. Fuel for the work required: a theoretical framework for carbohydrate periodization and the glycogen threshold hypothesis. Sports Med. 2018;48:1031-1048. doi:10.1007/s40279-018-0867-7.",
    supports: "Marco teórico: ajustar el carbohidrato a la demanda de cada sesión. Solo 37% de los estudios de rendimiento mostró mejoras con estrategias de baja disponibilidad, aunque sí aumentó la señalización celular y la expresión génica.",
    level: "Revisión narrativa / marco teórico.",
    checked: "abstract",
  },
  {
    id: "R36",
    surnames: ["Rønnestad", "Ronnestad"],
    cite: "Rønnestad BR, et al. Effects of including sprints in one weekly low-intensity training session during the transition period of elite cyclists. Front Physiol. 2020;11:1000. doi:10.3389/fphys.2020.01000.",
    supports: "16 ciclistas de élite (VO2max 72±5), 3 semanas de transición con ~60% menos de carga y solo entrenamiento de baja intensidad: una sesión semanal de 90 min al 60% del VO2max con 3 series de 3×30 s de sprints máximos (4 min de recuperación activa a 100 W entre sprints, 15 min entre series; sprint sentado, 0,8 Nm/kg, desde 80 rpm) vs la misma sesión sin sprints (n=7 vs 9). Potencia en 30 s +4±5% vs −4±5%; rendimiento en 20 min −1±5% vs −3±5%; utilización fraccional del VO2max se mantuvo (+1,9 puntos) vs −2,5 puntos; VO2max sin cambios en ambos.",
    level: "ECA pequeño, 3 semanas, élite, en periodo de transición (no en plena temporada): evidencia PRELIMINAR. Los propios autores señalan que la intervención es corta y que no se controló el entrenamiento previo. No evaluó una progresión de 1 a 3 series.",
    checked: "fuente",
  },
  {
    id: "R37",
    surnames: ["Almquist"],
    cite: "Almquist NW, et al. The aerobic and anaerobic contribution during repeated 30-s sprints in elite cyclists. Front Physiol. 2021;12:692622. doi:10.3389/fphys.2021.692622.",
    supports: "En ciclistas de élite, al repetir sprints de 30 s la potencia media cae con cada sprint, sobre todo por menor potencia anaeróbica (−36 W entre el 1.º y 2.º; −58 W entre el 1.º y 3.º). En un campo de 14 días, el grupo con sprints mejoró 25±14 W más la potencia de sprint que el control, principalmente por potencia anaeróbica.",
    level: "Estudio en élite, muestra pequeña (9 vs 9 en la parte 2). Mejora la potencia de sprint; no demuestra mejoras aeróbicas.",
    checked: "abstract",
  },
  {
    id: "R38",
    surnames: ["Schumann"],
    cite: "Schumann M, et al. Compatibility of concurrent aerobic and strength training for skeletal muscle size and function: an updated systematic review and meta-analysis. Sports Med. 2022. doi:10.1007/s40279-021-01587-7.",
    supports: "43 estudios: el entrenamiento concurrente no comprometió la hipertrofia (DME −0,01) ni la fuerza máxima (−0,06); la fuerza explosiva se atenuó (−0,28), más cuando se entrenó en la misma sesión que cuando se separó ≥3 h. Sin efecto moderador del tipo de ejercicio aeróbico (bici vs carrera), la frecuencia, el estado de entrenamiento ni la edad.",
    level: "Metaanálisis. Mide adaptaciones de fuerza/masa muscular, NO el rendimiento de la sesión de bici del día siguiente ni la fatiga acumulada.",
    checked: "abstract",
  },
  {
    id: "R39",
    surnames: ["Galán-Rioja", "Galan-Rioja"],
    cite: "Galán-Rioja MÁ, et al. Training periodization, intensity distribution, and volume in trained cyclists: a systematic review. Int J Sports Physiol Perform. 2023;18(2).",
    supports: "No hay preponderancia de evidencia a favor de un modelo de periodización (tradicional o por bloques) en ciclistas de ruta entrenados; las distribuciones piramidal y polarizada resultaron eficaces y comparten un alto volumen relativo bajo el primer umbral de lactato/VT1; volumen sugerido de 7 a 12 h semanales.",
    level: "Revisión sistemática; intervenciones cortas (8-12 semanas), por lo que las conclusiones a largo plazo son limitadas.",
    checked: "abstract",
  },
  {
    id: "R40",
    surnames: ["Hatle"],
    cite: "Hatle H, et al. Effect of 24 sessions of high-intensity aerobic interval training carried out at either high or moderate frequency, a randomized trial. PLoS One. 2014;9:e88375. doi:10.1371/journal.pone.0088375.",
    supports: "21 adultos moderadamente entrenados, 24 sesiones de 4×4 min: alta frecuencia (24 sesiones en 3 semanas) vs moderada (en 8 semanas). VO2max +10,7% con frecuencia moderada vs +3,0% (n.s.) con alta frecuencia a los 4 días; la adaptación con alta frecuencia llegó más tarde (+6,1% a los 12 días).",
    level: "ECA pequeño en adultos moderadamente entrenados, NO ciclistas de élite. Compara dosis totales iguales, no una vs dos sesiones semanales.",
    checked: "abstract",
  },
  {
    id: "R41",
    surnames: ["Miyamoto"],
    cite: "Miyamoto et al. High-intensity interval training improves respiratory and cardiovascular adjustments before and after initiation of exercise. Front Physiol. 2024;15:1227316. doi:10.3389/fphys.2024.1227316.",
    supports: "21 estudiantes varones (HIIT n=11, control n=10), 8 semanas con UNA sesión semanal de 3 esfuerzos al 95% de la carga máxima hasta el agotamiento: VO2max +13% (p=0,008) en test de rampa.",
    level: "ECA pequeño en jóvenes sin entrenamiento: muestra que una sesión semanal puede producir adaptación, pero NO es extrapolable a ciclistas entrenados.",
    checked: "abstract",
  },
];

/** Apellidos que se aceptan como citas (el resto se marca como no verificado). */
export const ALLOWED_CITATION_SURNAMES = new Set(
  REFERENCES.flatMap((r) => r.surnames).map((s) => s.toLowerCase())
);

const CHECKED_LABEL: Record<Reference["checked"], string> = {
  fuente: "leída en la fuente",
  abstract: "cita y abstract verificados; texto completo no leído (no agregues detalles que no estén acá)",
  cita: "la cita existe pero el contenido NO se confirmó: no atribuyas cifras ni protocolos a esta fuente",
  resumen: "a partir de un resumen del libro",
};

export function referencesPrompt(): string {
  const lines = REFERENCES.map(
    (r) => `[${r.id}] ${r.cite}\n    Respalda: ${r.supports}\n    Nivel de evidencia: ${r.level}\n    Verificación: ${CHECKED_LABEL[r.checked]}`
  );
  return `--- BIBLIOGRAFÍA CERRADA (única fuente permitida para citar) ---\n${lines.join("\n")}\n`;
}
