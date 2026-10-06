import { prisma } from "@/lib/prisma";

/** Datos de la pantalla de Configuración (solo para uso en servidor: NO es una server action). */
export async function getSettingsData(athleteId: string) {
  const [template, goals, thresholds, user] = await Promise.all([
    prisma.trainingTemplateSlot.findMany({
      where: { athleteId },
      orderBy: { dayOfWeek: "asc" },
    }),
    prisma.athleteGoal.findMany({
      where: { athleteId },
      orderBy: { eventDate: "asc" },
    }),
    prisma.athleteThresholds.findUnique({ where: { athleteId } }),
    prisma.user.findUnique({ where: { id: athleteId } }),
  ]);

  return { template, goals, thresholds, user };
}
