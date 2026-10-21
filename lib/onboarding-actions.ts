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
  /** Mejor potencia de 5 min (la que se usa como potencia en VO2max) */
  p5: string;
  weight: string;
  days: { dayOfWeek: number; type: "cycling" | "gym" | "flexibility" | "rest"; quality: boolean; min: string }[];
  goal: { mode: "event" | "performance" | "general"; name: string; date: string; priority: "A" | "B" | "C"; profile: string; metric: "ftp" | "p5" | "weight"; target: string };
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
      const p5 = intIn(p.p5 ?? "", 80, 1500);
      if ((p.p5 ?? "").trim() && p5 == null) return { error: "La potencia de 5 min tiene que estar entre 80 y 1500 W" };
      const cur = await prisma.user.findUnique({ where: { id: athleteId }, select: { ftp: true, pvo2maxWatts: true, powerCurveJson: true } });
      // Si coincide con el mejor esfuerzo de 5 min de Intervals queda marcado como «desde Intervals»; si lo cambió a mano, como manual
      const best5 = (cur?.powerCurveJson as { points?: { secs: number; watts: number }[] } | null)?.points?.find((x) => x.secs === 300)?.watts ?? null;
      await prisma.user.update({
        where: { id: athleteId },
        data: {
          ...(ftp != null && ftp !== cur?.ftp ? { ftp, ftpUpdatedAt: new Date() } : {}),
          ...(p5 != null && p5 !== cur?.pvo2maxWatts ? { pvo2maxWatts: p5, pvo2maxUpdatedAt: new Date(), pvo2maxSource: p5 === best5 ? "intervals-5min" : "manual" } : {}),
          ...(weight != null ? { weight } : {}),
        },
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
      } else if (p.goal.mode === "performance") {
        const M = {
          ftp: { label: "W de FTP", lo: 50, hi: 600, from: intIn(p.ftp, 50, 600), verb: "Subir FTP a", unit: "W", power: true },
          p5: { label: "W en 5 min", lo: 80, hi: 1500, from: intIn(p.p5 ?? "", 80, 1500), verb: "Subir potencia de 5 min a", unit: "W", power: true },
          weight: { label: "kg de peso", lo: 30, hi: 200, from: (() => { const n = Number(String(p.weight).replace(",", ".")); return Number.isFinite(n) && n >= 30 && n <= 200 ? n : null; })(), verb: "Llegar a", unit: "kg", power: false },
        }[p.goal.metric] ?? null;
        if (!M) return { error: "Elegí qué querés mejorar" };
        const target = Number(String(p.goal.target).replace(",", "."));
        if (!Number.isFinite(target) || target < M.lo || target > M.hi) return { error: `La meta tiene que estar entre ${M.lo} y ${M.hi} ${M.unit}` };
        if (M.from == null) return { error: "Para fijar esta meta primero cargá tu valor actual en el paso «Tu bici»" };
        if (M.power && target <= M.from) return { error: `La meta tiene que ser mayor que tu valor actual (${M.from} ${M.unit})` };
        if (!M.power && target === M.from) return { error: "La meta tiene que ser distinta de tu peso actual" };
        const name = `${M.verb} ${target} ${M.unit}`;
        const date = /^\d{4}-\d{2}-\d{2}$/.test(p.goal.date) ? p.goal.date : "";
        const fd = new FormData();
        fd.set("goalType", "PERFORMANCE");
        fd.set("name", name);
        fd.set("metric", M.label);
        fd.set("baselineValue", String(M.from));
        fd.set("targetValue", String(target));
        fd.set("priority", "B");
        if (date) fd.set("eventDate", date);
        const exists = await prisma.athleteGoal.findFirst({ where: { athleteId, goalType: "PERFORMANCE", name, eventDate: date ? new Date(date) : null }, select: { id: true } });
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
