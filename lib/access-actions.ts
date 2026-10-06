"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCoachId } from "@/lib/access";
import { encryptSecret } from "@/lib/crypto";
import { getWellness } from "@/lib/intervals-client";
import { syncIntervals } from "@/lib/intervals-sync";
import { dateKeyLocal } from "@/lib/tz";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function inviteAthlete(formData: FormData) {
  const coachId = await requireCoachId();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) redirect("/settings?invite=invalid");
  await prisma.allowedEmail.upsert({ where: { email }, update: {}, create: { email, invitedById: coachId } });
  revalidatePath("/settings");
  redirect("/settings?invite=ok");
}

export async function removeInvite(formData: FormData) {
  const coachId = await requireCoachId();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const target = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (target?.id === coachId || target?.role === "COACH") throw new Error("No se puede quitar al entrenador");
  await prisma.allowedEmail.deleteMany({ where: { email } });
  // Corta las sesiones abiertas del alumno; sus datos se conservan
  if (target) await prisma.session.deleteMany({ where: { userId: target.id } });
  revalidatePath("/settings");
}

/** Guarda (cifradas) las credenciales de Intervals del usuario, tras comprobar que funcionan. */
export async function connectIntervals(formData: FormData) {
  const userId = await requireUserId();
  const athleteId = String(formData.get("athleteId") ?? "").trim();
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (!/^i?\d{3,12}$/.test(athleteId) || apiKey.length < 10 || apiKey.length > 200) redirect("/settings?intervals=invalid");

  const normalizedId = athleteId.startsWith("i") ? athleteId : `i${athleteId}`;
  try {
    const today = dateKeyLocal(new Date());
    await getWellness(normalizedId, apiKey, today, today);
  } catch {
    redirect("/settings?intervals=rejected");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { intervalsAthleteId: normalizedId, intervalsApiKeyEncrypted: encryptSecret(apiKey), intervalsLastSyncAt: null },
  });
  await syncIntervals(userId, 365); // primer sync: último año; el historial completo se pide aparte
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings?intervals=ok");
}

export async function disconnectIntervals() {
  const userId = await requireUserId();
  await prisma.user.update({ where: { id: userId }, data: { intervalsAthleteId: null, intervalsApiKeyEncrypted: null } });
  revalidatePath("/settings");
}

/** Trae hasta 5 años de historial (se usa una vez, después de conectar). */
export async function syncFullHistory() {
  const userId = await requireUserId();
  const r = await syncIntervals(userId, 1825);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect(`/settings?history=${r.activities}${r.errors.length ? `&historyErrors=${r.errors.length}` : ""}`);
}
