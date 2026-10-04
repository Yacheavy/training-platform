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

  await prisma.dailyCheckin.upsert({
    where: { date: today },
    update: {
      sleepQuality: Number(formData.get("sleepQuality")),
      fatigue: Number(formData.get("fatigue")),
      stress: Number(formData.get("stress")),
      muscleSoreness: Number(formData.get("muscleSoreness")),
      mood: Number(formData.get("mood")),
      freeText: String(formData.get("freeText") || ""),
    },
    create: {
      athleteId,
      date: today,
      sleepQuality: Number(formData.get("sleepQuality")),
      fatigue: Number(formData.get("fatigue")),
      stress: Number(formData.get("stress")),
      muscleSoreness: Number(formData.get("muscleSoreness")),
      mood: Number(formData.get("mood")),
      freeText: String(formData.get("freeText") || ""),
    },
  });

  revalidatePath("/dashboard");
}