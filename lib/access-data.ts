import { prisma } from "@/lib/prisma";

/** Datos para la pantalla de Configuración: estado de Intervals y (si es entrenador) alumnos invitados. */
export async function getAccessData(userId: string) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, intervalsAthleteId: true, intervalsApiKeyEncrypted: true, intervalsLastSyncAt: true },
  });
  const isCoach = me?.role === "COACH";
  let invites: { email: string; createdAt: Date; name: string | null; joined: boolean; isCoach: boolean }[] = [];
  if (isCoach) {
    const rows = await prisma.allowedEmail.findMany({ where: { OR: [{ invitedById: userId }, { invitedById: null }] }, orderBy: { createdAt: "asc" } });
    const users = await prisma.user.findMany({ where: { email: { in: rows.map((r) => r.email) } }, select: { email: true, name: true, role: true } });
    const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
    invites = rows.map((r) => ({ email: r.email, createdAt: r.createdAt, name: byEmail.get(r.email)?.name ?? null, joined: byEmail.has(r.email), isCoach: byEmail.get(r.email)?.role === "COACH" }));
  }
  return {
    isCoach,
    invites,
    intervals: {
      connected: !!(me?.intervalsAthleteId && me?.intervalsApiKeyEncrypted),
      athleteId: me?.intervalsAthleteId ?? null,
      usingLegacyEnv: isCoach && !(me?.intervalsAthleteId && me?.intervalsApiKeyEncrypted),
      lastSyncAt: me?.intervalsLastSyncAt ?? null,
    },
  };
}
