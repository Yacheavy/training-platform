"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

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

export async function saveTemplateSlot(formData: FormData) {
  const athleteId = await requireUserId();
  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const stimulusType = String(formData.get("stimulusType"));
  const isQualityDay = formData.get("isQualityDay") === "on";
  const targetDurationMin = Number(formData.get("targetDurationMin")) || null;

  await prisma.trainingTemplateSlot.upsert({
    where: { athleteId_dayOfWeek: { athleteId, dayOfWeek } },
    update: { stimulusType, isQualityDay, targetDurationMin },
    create: { athleteId, dayOfWeek, stimulusType, isQualityDay, targetDurationMin, appliesInPhases: [] },
  });

  revalidatePath("/settings");
}

export async function saveThresholds(formData: FormData) {
  const athleteId = await requireUserId();

  await prisma.athleteThresholds.upsert({
    where: { athleteId },
    update: {
      maxCtlRampPerWeek: Number(formData.get("maxCtlRampPerWeek")),
      hrvDropAlertPct: Number(formData.get("hrvDropAlertPct")),
      minTsb: Number(formData.get("minTsb")),
      maxConsecutiveBadSleepDays: Number(formData.get("maxConsecutiveBadSleepDays")),
      weeksBetweenFtpTest: Number(formData.get("weeksBetweenFtpTest")),
      ftpTestProtocol: String(formData.get("ftpTestProtocol")),
      deloadRatio: String(formData.get("deloadRatio")),
    },
    create: {
      athleteId,
      maxCtlRampPerWeek: Number(formData.get("maxCtlRampPerWeek")),
      hrvDropAlertPct: Number(formData.get("hrvDropAlertPct")),
      minTsb: Number(formData.get("minTsb")),
      maxConsecutiveBadSleepDays: Number(formData.get("maxConsecutiveBadSleepDays")),
      weeksBetweenFtpTest: Number(formData.get("weeksBetweenFtpTest")),
      ftpTestProtocol: String(formData.get("ftpTestProtocol")),
      deloadRatio: String(formData.get("deloadRatio")),
    },
  });

  revalidatePath("/settings");
}

export async function addGoal(formData: FormData) {
  const athleteId = await requireUserId();
  const eventDateStr = String(formData.get("eventDate"));
  const goalType = String(formData.get("goalType")) as "EVENT" | "PERFORMANCE";

  await prisma.athleteGoal.create({
    data: {
      athleteId,
      goalType,
      name: String(formData.get("name")),
      eventDate: eventDateStr ? new Date(eventDateStr) : null,
      priority: String(formData.get("priority")) as "A" | "B" | "C",
      metric: goalType === "PERFORMANCE" ? String(formData.get("metric") || "") || null : null,
      baselineValue: goalType === "PERFORMANCE" && formData.get("baselineValue") ? Number(formData.get("baselineValue")) : null,
      targetValue: goalType === "PERFORMANCE" && formData.get("targetValue") ? Number(formData.get("targetValue")) : null,
    },
  });

  revalidatePath("/settings");
}

export async function deleteGoal(formData: FormData) {
  await requireUserId();
  const id = String(formData.get("id"));
  await prisma.athleteGoal.delete({ where: { id } });
  revalidatePath("/settings");
}
export async function saveProfile(formData: FormData) {
  const athleteId = await requireUserId();

  await prisma.user.update({
    where: { id: athleteId },
    data: {
      trainingBackground: String(formData.get("trainingBackground") || ""),
      currentStateNote: String(formData.get("currentStateNote") || ""),
      currentStateUpdatedAt: new Date(),
      preferences: String(formData.get("preferences") || ""),
    },
  });

  revalidatePath("/settings");
}