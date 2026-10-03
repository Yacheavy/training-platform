import { getWellness } from "@/lib/intervals-client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

function mapWellness(w: any, userId: string) {
  return {
    athleteId: userId,
    date: new Date(w.id), // en wellness, Intervals usa "id" como la fecha (YYYY-MM-DD)
    hrv: w.hrv,
    restingHr: w.restingHR,
    sleepScore: w.sleepScore,
    sleepHours: w.sleepSecs ? w.sleepSecs / 3600 : null,
    steps: w.steps,
    spo2: w.spO2,
    stressScore: w.stress,
    ctl: w.ctl,
    atl: w.atl,
    rampRate: w.rampRate,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const apiKey = process.env.INTERVALS_API_KEY_DEV!;
  const athleteId = process.env.INTERVALS_ATHLETE_ID_DEV!;
  const userId = session.user.id;

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
      const wellnessRecords = await getWellness(athleteId, apiKey, oldestStr, newestStr);

      for (const w of wellnessRecords) {
        try {
          const mapped = mapWellness(w, userId);
          await prisma.wellness.upsert({
            where: { date: mapped.date },
            update: mapped,
            create: mapped,
          });
          inserted++;
        } catch (err) {
          skipped++;
          errors.push(`Wellness ${w.id}: ${String(err)}`);
        }
      }
    } catch (err) {
      errors.push(`Rango ${oldestStr} a ${newestStr}: ${String(err)}`);
    }
  }

  return NextResponse.json({ inserted, skipped, errors: errors.slice(0, 10) });
}
