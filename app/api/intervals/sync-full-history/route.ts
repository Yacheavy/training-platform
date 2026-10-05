import { getActivities } from "@/lib/intervals-client";
import { mapActivity } from "@/lib/intervals-sync";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const apiKey = process.env.INTERVALS_API_KEY_DEV!;
  const athleteId = process.env.INTERVALS_ATHLETE_ID_DEV!;
  const userId = session.user.id;

  // Traemos en bloques de 1 año hacia atrás, hasta 5 años, para cubrir
  // todo tu historial sin pedirle a la API un rango gigante de una sola vez
  const today = new Date();
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let yearsBack = 0; yearsBack < 5; yearsBack++) {
    const newest = new Date(today);
    newest.setFullYear(today.getFullYear() - yearsBack);
    const oldest = new Date(newest);
    oldest.setFullYear(newest.getFullYear() - 1);

    const oldestStr = oldest.toISOString().split("T")[0];
    const newestStr = newest.toISOString().split("T")[0];

    try {
      const activities = await getActivities(athleteId, apiKey, oldestStr, newestStr);

      for (const a of activities) {
        try {
          await prisma.activity.upsert({
            where: { intervalsActivityId: a.id },
            update: mapActivity(a, userId),
            create: mapActivity(a, userId),
          });
          inserted++;
        } catch (err) {
          skipped++;
          errors.push(`Activity ${a.id}: ${String(err)}`);
        }
      }
    } catch (err) {
      errors.push(`Rango ${oldestStr} a ${newestStr}: ${String(err)}`);
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { intervalsFullHistorySyncedAt: new Date() },
  });

  return NextResponse.json({ inserted, skipped, errors: errors.slice(0, 10) });
}