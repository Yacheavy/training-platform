"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCoachId, requireCoachOfStudent } from "@/lib/access";
import { addGoalCore, deleteGoalCore, saveTemplateCore, saveThresholdsCore, updateGoalProfileCore } from "@/lib/settings-core";
import { runRegeneration, regenerationQuery, deletePlannedSessionsOfBlock } from "@/lib/plan-core";
import { pushWorkoutToIntervals } from "@/lib/push-workout";
import { dayRangeLocal } from "@/lib/tz";
import { applySeasonCore } from "@/lib/season-apply";
import { mailConfigured, sendMail } from "@/lib/email/mailer";
import { bodyToHtml, layoutEmail } from "@/lib/email/template";

/**
 * Acciones del entrenador sobre la planificación de SUS alumnos. Cada una vuelve a verificar en el servidor que el
 * alumno es de ese entrenador (el id que llega del cliente no se da por bueno). El alcance es el que eligió el entrenador:
 * objetivos, temporada, plan, semana tipo y estilo del plan. Además puede corregir el FTP y la potencia en VO2max (PAM) del alumno. Las sesiones sueltas las maneja cada alumno.
 */
const COACH_NOTE = "Armado por tu coach";

async function authorize(athleteId: string) {
  const coachId = await requireCoachId();
  const student = await requireCoachOfStudent(athleteId);
  const coach = await prisma.user.findUnique({ where: { id: coachId }, select: { name: true } });
  return { student, coachName: coach?.name ?? null };
}

const refresh = (athleteId: string) => {
  for (const p of [`/alumnos/${athleteId}/planificacion`, `/alumnos/${athleteId}`, "/planificacion", "/dashboard", "/calendar", "/settings"]) revalidatePath(p);
};

/** Marca el cambio (aviso dentro de la app) y le manda un mail al alumno. El mail es de cortesía: si falla no rompe nada. */
async function notifyStudent(student: { id: string; email: string; name: string | null }, coachName: string | null, summary: string) {
  await prisma.user.update({ where: { id: student.id }, data: { coachPlanUpdatedAt: new Date() } });
  if (!mailConfigured()) return;
  const who = coachName ?? "Tu coach";
  const title = "Tu coach actualizó tu plan de entrenamiento";
  const body = `${who} cambió tu planificación. ${summary}\n\nEntrá a la app para ver tu semana. Si algo no te cierra, hablalo con tu coach: vos también podés ajustar tus días y tu estilo de plan desde Planificación.`;
  try {
    await sendMail({
      to: student.email,
      subject: title,
      html: layoutEmail({ title, bodyHtml: bodyToHtml(body), ctaLabel: "Ver mi plan", ctaPath: "/calendar" }),
      text: `${title}\n\n${body}`,
    });
  } catch (e) {
    console.error("notifyStudent: no se pudo enviar el mail", e);
  }
}

const studentErr = (msg: string) =>
  msg.replace("Cargá tu FTP en Ajustes antes de generar la temporada.", "Este alumno todavía no cargó su FTP: tiene que hacerlo él en Ajustes antes de generar la temporada.")
    .replace("Armá tu semana tipo (qué días entrenás) antes de generar la temporada.", "Armá primero la semana tipo del alumno (qué días entrena) y guardala.");

export async function coachAddGoal(athleteId: string, formData: FormData): Promise<{ error: string } | void> {
  try {
    await authorize(athleteId);
    await addGoalCore(athleteId, formData, true);
    refresh(athleteId);
  } catch (e) {
    return { error: e instanceof Error && e.message ? e.message : "No se pudo guardar el objetivo." };
  }
}

export async function coachDeleteGoal(athleteId: string, formData: FormData): Promise<{ error: string } | void> {
  try {
    await authorize(athleteId);
    await deleteGoalCore(athleteId, formData);
    refresh(athleteId);
  } catch (e) {
    return { error: e instanceof Error && e.message ? e.message : "No se pudo quitar el objetivo." };
  }
}

export async function coachUpdateGoalProfile(athleteId: string, formData: FormData): Promise<{ error: string } | void> {
  try {
    await authorize(athleteId);
    await updateGoalProfileCore(athleteId, formData);
    refresh(athleteId);
  } catch (e) {
    return { error: e instanceof Error && e.message ? e.message : "No se pudo guardar el perfil de la prueba." };
  }
}

export async function coachSaveTemplate(athleteId: string, formData: FormData): Promise<{ error: string } | void> {
  try {
    await authorize(athleteId);
    await saveTemplateCore(athleteId, formData);
    refresh(athleteId);
  } catch (e) {
    return { error: e instanceof Error && e.message ? e.message : "No se pudo guardar la semana tipo." };
  }
}

export async function coachSaveThresholds(athleteId: string, formData: FormData): Promise<{ error: string } | void> {
  try {
    await authorize(athleteId);
    await saveThresholdsCore(athleteId, formData);
    refresh(athleteId);
  } catch (e) {
    return { error: e instanceof Error && e.message ? e.message : "No se pudo guardar el estilo del plan." };
  }
}

/** Regenera las sesiones planificadas del alumno desde hoy, las marca como armadas por el coach y avisa al alumno. */
export async function coachRegeneratePlan(athleteId: string) {
  const { student, coachName } = await authorize(athleteId);
  const r = await runRegeneration(athleteId, COACH_NOTE);
  if (r.created > 0) await notifyStudent(student, coachName, `Se regeneraron ${r.created} sesiones desde hoy.`);
  refresh(athleteId);
  redirect(`/alumnos/${athleteId}/planificacion?${regenerationQuery(r)}`);
}

/** Crea los bloques propuestos de la temporada del alumno y genera sus sesiones. */
export async function coachApplySeason(athleteId: string, _formData?: FormData): Promise<{ error: string } | { blocks: number; sessions: number }> {
  try {
    const { student, coachName } = await authorize(athleteId);
    const r = await applySeasonCore(prisma, athleteId, new Date(), COACH_NOTE);
    if ("error" in r) return { error: studentErr(r.error) };
    await notifyStudent(student, coachName, `Se creó su temporada: ${r.blocks} bloque${r.blocks === 1 ? "" : "s"} y ${r.sessions} sesiones.`);
    refresh(athleteId);
    return { blocks: r.blocks, sessions: r.sessions };
  } catch (e) {
    console.error("coachApplySeason falló", e);
    return { error: e instanceof Error && e.message ? `No se pudo crear la temporada: ${studentErr(e.message)}` : "No se pudo crear la temporada. Probá de nuevo." };
  }
}

/** Elimina un bloque del alumno que todavía no empezó, con sus sesiones planificadas (no toca completadas, editadas ni enviadas a mano). */
export async function coachDeleteFutureBlock(athleteId: string, formData: FormData): Promise<{ error: string } | void> {
  try {
    await authorize(athleteId);
    const id = String(formData.get("blockId") ?? "");
    const block = await prisma.trainingBlock.findFirst({ where: { id, athleteId } });
    if (!block) return { error: "Bloque no encontrado" };
    if (block.startDate.getTime() <= Date.now()) return { error: "Solo se pueden eliminar bloques que todavía no empezaron" };
    await deletePlannedSessionsOfBlock(athleteId, block);
    await prisma.weeklyReview.deleteMany({ where: { trainingBlockId: id } });
    await prisma.trainingBlock.delete({ where: { id } });
    refresh(athleteId);
  } catch (e) {
    return { error: e instanceof Error && e.message ? e.message : "No se pudo eliminar el bloque." };
  }
}

/**
 * Preferencia de mail de las salidas de UN alumno (con IA, solo resumen o sin mail). Es la preferencia de ese alumno: no toca la del entrenador.
 * El alumno también puede cambiarla desde sus Ajustes; vale la última que se guardó.
 */
export async function coachSetStudentEmail(athleteId: string, formData: FormData): Promise<{ error: string } | void> {
  try {
    await authorize(athleteId);
    const mode = String(formData.get("mode") ?? "");
    if (mode !== "AI" && mode !== "SUMMARY" && mode !== "OFF") return { error: "Opción no válida." };
    await prisma.user.update({
      where: { id: athleteId },
      data: mode === "OFF" ? { emailAnalysis: false } : { emailAnalysis: true, emailKind: mode },
    });
    refresh(athleteId);
  } catch (e) {
    return { error: e instanceof Error && e.message ? e.message : "No se pudo guardar la preferencia." };
  }
}

/**
 * Aprueba y manda a Intervals las sesiones pendientes del alumno (hoy y las próximas 3 semanas), usando la conexión
 * de Intervals del propio alumno. Las ya enviadas no se tocan. Si alguna falla, el resto sigue y se informa.
 */
export async function coachSendPlanToIntervals(athleteId: string, _formData?: FormData): Promise<{ error: string } | { sent: number }> {
  try {
    await authorize(athleteId);
    const from = dayRangeLocal(new Date()).start;
    const end = new Date(from.getTime() + 21 * 24 * 60 * 60 * 1000);
    const pending = await prisma.generatedWorkout.findMany({
      where: { athleteId, date: { gte: from, lt: end }, status: { in: ["PLANNED", "SUGGESTED", "EDITED", "APPROVED"] } },
      orderBy: { date: "asc" },
      select: { id: true, status: true },
    });
    if (pending.length === 0) return { error: "No hay sesiones pendientes de enviar." };
    let sent = 0;
    const failed: string[] = [];
    for (const w of pending) {
      try {
        if (w.status !== "APPROVED") await prisma.generatedWorkout.update({ where: { id: w.id }, data: { status: "APPROVED", approvedAt: new Date() } });
        await pushWorkoutToIntervals(athleteId, w.id);
        sent++;
      } catch (err) {
        console.error("coachSendPlanToIntervals: falló una sesión", err);
        failed.push(err instanceof Error ? err.message : "error");
      }
    }
    refresh(athleteId);
    if (failed.length > 0) return { error: `Se enviaron ${sent} de ${pending.length}. ${failed[0]}` };
    return { sent };
  } catch (e) {
    console.error("coachSendPlanToIntervals falló", e);
    return { error: "No se pudo enviar el plan a Intervals. Probá de nuevo." };
  }
}

function intInRange(raw: FormDataEntryValue | null, min: number, max: number): number | null {
  const n = Number(raw);
  return raw !== null && String(raw).trim() !== "" && Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
}

/**
 * El entrenador fija el FTP y la PAM (potencia en VO2max) de un alumno suyo. El FTP no se borra (vacío = sin cambio);
 * la PAM vacía la borra (el HIIT vuelve a usar un % del FTP). No regenera los planes ya creados: lo avisa la pantalla.
 */
export async function saveStudentMetrics(athleteId: string, formData: FormData) {
  const { student } = await authorize(athleteId);
  const current = await prisma.user.findUnique({ where: { id: student.id }, select: { ftp: true, pvo2maxWatts: true } });
  const rawFtp = formData.get("ftp");
  const rawPam = formData.get("pvo2maxWatts");
  const ftp = intInRange(rawFtp, 50, 600);
  const pam = intInRange(rawPam, 100, 800);
  if (String(rawFtp ?? "").trim() !== "" && ftp == null) throw new Error("FTP fuera de rango (50 a 600 W)");
  if (String(rawPam ?? "").trim() !== "" && pam == null) throw new Error("PAM fuera de rango (100 a 800 W)");
  if (ftp != null && pam != null && pam <= ftp) throw new Error("La PAM tiene que ser mayor que el FTP");
  const finalFtp = ftp ?? current?.ftp ?? null;
  if (pam != null && finalFtp != null && pam <= finalFtp) throw new Error("La PAM tiene que ser mayor que el FTP");

  await prisma.user.update({
    where: { id: student.id },
    data: {
      ...(ftp != null && ftp !== current?.ftp ? { ftp, ftpUpdatedAt: new Date() } : {}),
      ...(pam !== (current?.pvo2maxWatts ?? null) ? { pvo2maxWatts: pam, pvo2maxUpdatedAt: new Date(), pvo2maxSource: pam == null ? null : "coach" } : {}),
    },
  });
  refresh(student.id);
}
