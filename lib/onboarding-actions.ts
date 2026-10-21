"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCoachId, requireCoachOfStudent } from "@/lib/access";
import { addGoalCore, saveTemplateCore } from "@/lib/settings-core";
import { mailConfigured, sendMail, appUrl } from "@/lib/email/mailer";
import { layoutEmail } from "@/lib/email/template";

/** Puesta en marcha guiada del alumno: cada paso se guarda al pasar al siguiente, y al final se envía al coach para revisar. */

export interface OnboardingPayload {
  ftp: string;
  weight: string;
  days: { dayOfWeek: number; type: "cycling" | "gym" | "flexibility" | "rest"; quality: boolean; min: string }[];
  goal: { mode: "event" | "general"; name: string; date: string; priority: "A" | "B" | "C"; profile: string };
  background: string;
  injuries: string;
  preferences: string;
}

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

const intIn = (v: string, lo: number, hi: number): number | null => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : null;
};

/** Guarda un paso (1 bici, 2 semana, 3 objetivo, 4 límites). Devuelve {error} para mostrarlo en el asistente. */
export async function saveOnboardingStep(step: number, p: OnboardingPayload): Promise<{ error: string } | void> {
  try {
    const athleteId = await requireUserId();
    if (step === 1) {
      const ftp = intIn(p.ftp, 50, 600);
      const wRaw = Number(String(p.weight).replace(",", "."));
      const weight = Number.isFinite(wRaw) && wRaw >= 30 && wRaw <= 200 ? Math.round(wRaw * 10) / 10 : null;
      if (p.ftp.trim() && ftp == null) return { error: "El FTP tiene que estar entre 50 y 600 W" };
      if (p.weight.trim() && weight == null) return { error: "El peso tiene que estar entre 30 y 200 kg" };
      const cur = await prisma.user.findUnique({ where: { id: athleteId }, select: { ftp: true } });
      await prisma.user.update({
        where: { id: athleteId },
        data: { ...(ftp != null && ftp !== cur?.ftp ? { ftp, ftpUpdatedAt: new Date() } : {}), ...(weight != null ? { weight } : {}) },
      });
    } else if (step === 2) {
      const fd = new FormData();
      for (const d of p.days) {
        fd.set(`type_${d.dayOfWeek}`, d.type);
        if (d.quality && d.type === "cycling") fd.set(`quality_${d.dayOfWeek}`, "on");
        fd.set(`min_${d.dayOfWeek}`, d.type === "rest" ? "" : d.min);
      }
      if (!p.days.some((d) => d.type === "cycling")) return { error: "Elegí al menos un día de bici" };
      await saveTemplateCore(athleteId, fd);
    } else if (step === 3) {
      if (p.goal.mode === "event") {
        if (!p.goal.name.trim()) return { error: "Poné el nombre de la carrera (o elegí «Mejorar en general»)" };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(p.goal.date)) return { error: "Elegí la fecha de la carrera" };
        // Una sola carrera cargada por el asistente: si lo repite, se reemplaza la anterior que cargó él mismo
        const fd = new FormData();
        fd.set("goalType", "EVENT");
        fd.set("name", p.goal.name);
        fd.set("eventDate", p.goal.date);
        fd.set("priority", p.goal.priority);
        fd.set("courseProfile", p.goal.profile);
        const exists = await prisma.athleteGoal.findFirst({ where: { athleteId, goalType: "EVENT", name: p.goal.name.trim().slice(0, 120), eventDate: new Date(p.goal.date) }, select: { id: true } });
        if (!exists) await addGoalCore(athleteId, fd);
      }
    } else if (step === 4) {
      await prisma.user.update({
        where: { id: athleteId },
        data: {
          trainingBackground: p.background.trim().slice(0, 2000) || null,
          currentStateNote: p.injuries.trim().slice(0, 2000) || null,
          currentStateUpdatedAt: new Date(),
          preferences: p.preferences.trim().slice(0, 2000) || null,
        },
      });
    }
    revalidatePath("/dashboard");
  } catch (e) {
    return { error: e instanceof Error && e.message ? e.message : "No se pudo guardar este paso." };
  }
}

/** Fin del asistente: queda «para revisar» y se avisa al entrenador por mail (si el envío falla, el aviso igual queda en su lista). */
export async function submitOnboarding(): Promise<{ error: string } | { reviewer: string | null }> {
  try {
    const athleteId = await requireUserId();
    const me = await prisma.user.findUnique({ where: { id: athleteId }, select: { id: true, name: true, email: true, coachId: true } });
    if (!me) return { error: "No se encontró tu cuenta" };
    const days = await prisma.trainingTemplateSlot.count({ where: { athleteId, stimulusType: "cycling" } });
    if (days === 0) return { error: "Falta elegir tus días de bici en el paso «Tu semana»" };
    await prisma.user.update({ where: { id: athleteId }, data: { onboardingSubmittedAt: new Date(), onboardingReviewedAt: null } });

    const invite = await prisma.allowedEmail.findFirst({ where: { email: me.email }, select: { invitedById: true } });
    const coachId = invite?.invitedById ?? me.coachId;
    const coach = coachId ? await prisma.user.findUnique({ where: { id: coachId }, select: { name: true, email: true } }) : null;
    if (coach && mailConfigured()) {
      const title = `${me.name ?? me.email} completó su configuración`;
      await sendMail({
        to: coach.email,
        subject: title,
        html: layoutEmail({ title, subtitle: "Para revisar", bodyHtml: `<p>${(me.name ?? me.email).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)} terminó la puesta en marcha: FTP, semana tipo, objetivo y límites. Revisala y corregí lo que haga falta.</p>`, ctaLabel: "Ver la configuración", ctaPath: `/alumnos/${me.id}`, ai: false }),
        text: `${title}\n\nRevisala en ${appUrl()}/alumnos/${me.id}`,
      }).catch((e) => console.error("Aviso al coach de la configuración", e));
    }
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    return { reviewer: coach?.name ?? null };
  } catch (e) {
    return { error: e instanceof Error && e.message ? e.message : "No se pudo enviar" };
  }
}

export async function skipOnboarding() {
  const athleteId = await requireUserId();
  await prisma.user.update({ where: { id: athleteId }, data: { onboardingSkippedAt: new Date() } });
  revalidatePath("/dashboard");
}

/** El entrenador marca la configuración del alumno como revisada (después de corregir lo que hiciera falta). */
export async function markOnboardingReviewed(athleteId: string): Promise<{ error: string } | void> {
  try {
    await requireCoachId();
    await requireCoachOfStudent(athleteId);
    await prisma.user.update({ where: { id: athleteId }, data: { onboardingReviewedAt: new Date() } });
    for (const p of [`/alumnos/${athleteId}`, "/settings", "/dashboard"]) revalidatePath(p);
  } catch (e) {
    return { error: e instanceof Error && e.message ? e.message : "No se pudo marcar como revisada" };
  }
}
