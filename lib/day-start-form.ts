import { prisma } from "@/lib/prisma";
import { dayKeyDate } from "@/lib/tz";
import { pickDayStartForm, DAY_MS, FORM_MAX_AGE_DAYS } from "@/lib/training-engine/day-start-form";

/** Forma al empezar el día de hoy (cierre de ayer) de un atleta; null si no hay un dato reciente. Ver training-engine/day-start-form.ts. */
export async function getDayStartForm(athleteId: string) {
  const today = dayKeyDate(new Date());
  const rows = await prisma.wellness.findMany({
    where: { athleteId, date: { lt: today, gte: new Date(today.getTime() - (FORM_MAX_AGE_DAYS + 1) * DAY_MS) }, ctl: { not: null }, atl: { not: null } },
    orderBy: { date: "desc" },
    take: 6,
    select: { date: true, ctl: true, atl: true, rampRate: true },
  });
  return pickDayStartForm(rows, today);
}
