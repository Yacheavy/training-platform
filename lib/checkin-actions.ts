"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { dayKeyDate } from "@/lib/tz";

export async function saveCheckin(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const athleteId = session.user.id;
  const today = dayKeyDate(new Date());

  // Escala 1–7 obligatoria (sin esto Number(null) = 0 dispararía alertas falsas)
  const scale = (name: string): number => {
    const n = Number(formData.get(name));
    if (!Number.isInteger(n) || n < 1 || n > 7) throw new Error(`Valor inválido en "${name}" (1 a 7)`);
    return n;
  };
  const values = {
    sleepQuality: scale("sleepQuality"),
    fatigue: scale("fatigue"),
    stress: scale("stress"),
    muscleSoreness: scale("muscleSoreness"),
    mood: scale("mood"),
    freeText: String(formData.get("freeText") || "").slice(0, 500),
  };

  await prisma.dailyCheckin.upsert({
    where: { athleteId_date: { athleteId, date: today } },
    update: values,
    create: { athleteId, date: today, ...values },
  });

  revalidatePath("/dashboard");
}