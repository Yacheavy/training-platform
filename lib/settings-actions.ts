"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { refreshAthleteMetrics } from "@/lib/athlete-metrics";

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

function intInRange(raw: FormDataEntryValue | null, min: number, max: number): number | null {
  const n = Number(raw);
  return raw !== null && String(raw).trim() !== "" && Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
}

/** Guarda a mano FTP, potencia en VO2max, FC de umbral y FC máxima. Vacío = borrar (salvo FTP, que no se borra). */
export async function saveMetrics(formData: FormData) {
  const athleteId = await requireUserId();
  const current = await prisma.user.findUnique({ where: { id: athleteId } });
  const ftp = intInRange(formData.get("ftp"), 50, 600);
  const pvo2 = intInRange(formData.get("pvo2maxWatts"), 100, 800);
  const lthr = intInRange(formData.get("lthr"), 80, 220);
  const maxHr = intInRange(formData.get("maxHr"), 120, 230);

  await prisma.user.update({
    where: { id: athleteId },
    data: {
      ...(ftp != null && ftp !== current?.ftp ? { ftp, ftpUpdatedAt: new Date() } : {}),
      ...(pvo2 !== (current?.pvo2maxWatts ?? null) ? { pvo2maxWatts: pvo2, pvo2maxUpdatedAt: new Date(), pvo2maxSource: pvo2 == null ? null : "manual" } : {}),
      lthr,
      maxHr,
    },
  });
  revalidatePath("/settings");
}

/** Copia a la app un valor leído de Intervals (FTP, FC de umbral, FC máxima) o el mejor esfuerzo de 5 min como potencia en VO2max. */
export async function applyIntervalsValue(formData: FormData) {
  const athleteId = await requireUserId();
  const field = String(formData.get("field"));
  const user = await prisma.user.findUnique({ where: { id: athleteId } });
  const ss = user?.sportSettingsJson as { ftp?: number | null; lthr?: number | null; maxHr?: number | null } | null;
  const curve = user?.powerCurveJson as { points?: { secs: number; watts: number }[] } | null;

  if (field === "ftp" && ss?.ftp) await prisma.user.update({ where: { id: athleteId }, data: { ftp: ss.ftp, ftpUpdatedAt: new Date() } });
  else if (field === "lthr" && ss?.lthr) await prisma.user.update({ where: { id: athleteId }, data: { lthr: ss.lthr } });
  else if (field === "maxHr" && ss?.maxHr) await prisma.user.update({ where: { id: athleteId }, data: { maxHr: ss.maxHr } });
  else if (field === "pvo2maxWatts") {
    const best5 = curve?.points?.find((p) => p.secs === 300)?.watts;
    if (best5) await prisma.user.update({ where: { id: athleteId }, data: { pvo2maxWatts: best5, pvo2maxUpdatedAt: new Date(), pvo2maxSource: "intervals-5min" } });
  }
  revalidatePath("/settings");
}

export async function refreshMetricsNow() {
  const athleteId = await requireUserId();
  await refreshAthleteMetrics(athleteId);
  revalidatePath("/settings");
}
