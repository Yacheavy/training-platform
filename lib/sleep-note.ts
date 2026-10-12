/**
 * Nota de sueño para el análisis de la IA: SOLO cuando es notable, para no repetir lo que el atleta ya ve en el dashboard.
 * Notable = menos de 6 h dormidas (reloj) o calidad del check-in ≤ 2/7 (el mismo corte que usa el semáforo).
 * Criterio de diseño, no un umbral validado: el sueño corto es contexto para leer la sesión, nunca una causa afirmada.
 */
export const SHORT_SLEEP_HOURS = 6;
export const POOR_SLEEP_QUALITY = 2;

export interface SleepInput {
  /** Horas dormidas medidas por el reloj (null si no hay). */
  sleepHours: number | null;
  /** Calidad de sueño del check-in de hoy (1–7, 7 = mejor) o null. */
  checkinQuality: number | null;
}

export function sleepNote(i: SleepInput): string | null {
  const short = i.sleepHours != null && i.sleepHours > 0 && i.sleepHours < SHORT_SLEEP_HOURS;
  const poor = i.checkinQuality != null && i.checkinQuality <= POOR_SLEEP_QUALITY;
  if (!short && !poor) return null;
  const facts: string[] = [];
  if (short) facts.push(`el reloj registró ${i.sleepHours!.toFixed(1).replace(".", ",")} h de sueño`);
  if (poor) facts.push(`en el check-in calificó su sueño ${i.checkinQuality}/7`);
  return (
    `SUEÑO PREVIO (dato notable): ${facts.join(" y ")}. Mencionalo UNA sola vez y en una frase, como contexto que puede haber influido en cómo se sintió o rindió la sesión (hipótesis, nunca causa), ` +
    `y solo si el dato de la sesión lo sostiene (potencia o FC por debajo de lo esperable, desacople alto, RPE alto). No lo uses para justificar una sesión buena, ni cites cifras de rendimiento que no estén en el contexto. ` +
    `Un solo sueño corto tiene efectos pequeños y variables en el rendimiento; los efectos claros aparecen con privación más larga (Craven y col., 2022).`
  );
}

/** Rango de referencia para adultos (Walsh y col., 2021: consenso de expertos sobre sueño y atletas). Informativo: no entra al semáforo. */
export const SLEEP_RANGE = { lo: 7, hi: 9 };
export const MIN_SLEEP_DAYS = 4;

/** Promedio de los últimos 7 días hasta la última noche con dato (mínimo 4 noches). Ignora valores 0 o ausentes. */
export function sleepAverage7d(rows: { date: Date; sleepHours: number | null }[], lastDate: Date | null): { avg: number; n: number } | null {
  if (!lastDate) return null;
  const from = lastDate.getTime() - 6 * 24 * 60 * 60 * 1000;
  const v = rows.filter((r) => r.date.getTime() >= from && r.date.getTime() <= lastDate.getTime() && r.sleepHours != null && r.sleepHours > 0).map((r) => r.sleepHours!);
  if (v.length < MIN_SLEEP_DAYS) return null;
  return { avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length };
}

/** Línea informativa bajo la tarjeta de sueño. Sin juicio por encima del rango. */
export function sleepTrendText(t: { avg: number; n: number } | null): string | null {
  if (!t) return null;
  const h = t.avg.toFixed(1).replace(".", ",");
  if (t.avg < SLEEP_RANGE.lo) return `7 días: ${h} h · bajo el rango de ${SLEEP_RANGE.lo}–${SLEEP_RANGE.hi} h`;
  if (t.avg <= SLEEP_RANGE.hi) return `7 días: ${h} h · dentro de ${SLEEP_RANGE.lo}–${SLEEP_RANGE.hi} h`;
  return `7 días: ${h} h`;
}
