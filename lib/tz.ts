/**
 * Zona horaria del atleta. El servidor (Vercel) corre en UTC, así que
 * "hoy", "esta semana" o el día de la semana NO pueden salir de
 * Date#getDay/setHours: después de las 21:00 en Buenos Aires ya serían
 * "mañana". Argentina no usa horario de verano, el offset es fijo (-3).
 */
export const ATHLETE_TZ = "America/Argentina/Buenos_Aires";
const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: ATHLETE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" del día calendario del atleta para ese instante. */
export function dateKeyLocal(d: Date): string {
  return fmt.format(d);
}

/** 0=domingo … 6=sábado, según el calendario del atleta. */
export function dayOfWeekLocal(d: Date): number {
  const [y, m, day] = dateKeyLocal(d).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}

/** Instante UTC en que empieza (00:00 local) el día del atleta. */
export function dayStartLocal(d: Date): Date {
  const [y, m, day] = dateKeyLocal(d).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day) + OFFSET_MS);
}

/** [start, end) del día local. */
export function dayRangeLocal(d: Date): { start: Date; end: Date } {
  const start = dayStartLocal(d);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** [start, end) de la semana local (domingo a sábado). */
export function weekRangeLocal(d: Date): { start: Date; end: Date } {
  const dayStart = dayStartLocal(d);
  const start = new Date(dayStart.getTime() - dayOfWeekLocal(d) * DAY_MS);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

/**
 * Clave estable de "día calendario" para campos únicos por fecha (check-in):
 * medianoche UTC del día local. Evita que un check-in a las 22:00 caiga en mañana.
 */
export function dayKeyDate(d: Date): Date {
  const [y, m, day] = dateKeyLocal(d).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
