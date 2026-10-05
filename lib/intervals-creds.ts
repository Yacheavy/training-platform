import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";

export interface IntervalsCreds {
  apiKey: string;
  athleteId: string;
}

/**
 * Credenciales de Intervals de UN usuario (cifradas en la base). Solo el entrenador (rol COACH)
 * puede caer a las variables de entorno históricas, para no cortar su sincronización actual
 * hasta que cargue su clave en Configuración. Un alumno sin clave propia NUNCA usa la del entrenador.
 */
export async function getIntervalsCreds(userId: string): Promise<IntervalsCreds | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, intervalsAthleteId: true, intervalsApiKeyEncrypted: true },
  });
  if (!user) return null;
  if (user.intervalsAthleteId && user.intervalsApiKeyEncrypted) {
    try {
      return { athleteId: user.intervalsAthleteId, apiKey: decryptSecret(user.intervalsApiKeyEncrypted) };
    } catch {
      return null;
    }
  }
  if (user.role === "COACH" && process.env.INTERVALS_API_KEY_DEV && process.env.INTERVALS_ATHLETE_ID_DEV) {
    return { apiKey: process.env.INTERVALS_API_KEY_DEV, athleteId: process.env.INTERVALS_ATHLETE_ID_DEV };
  }
  return null;
}
