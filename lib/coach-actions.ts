"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCoachId, requireCoachOfStudent } from "@/lib/access";
import { addGoalCore, deleteGoalCore, saveTemplateCore, saveThresholdsCore } from "@/lib/settings-core";
import { runRegeneration, regenerationQuery } from "@/lib/plan-core";
import { applySeasonCore } from "@/lib/season-apply";
import { mailConfigured, sendMail } from "@/lib/email/mailer";
import { bodyToHtml, layoutEmail } from "@/lib/email/template";

/**
 * Acciones del entrenador sobre la planificación de SUS alumnos. Cada una vuelve a verificar en el servidor que el
 * alumno es de ese entrenador (el id que llega del cliente no se da por bueno). El alcance es el que eligió el entrenador:
 * objetivos, temporada, plan, semana tipo y estilo del plan. El FTP y las sesiones sueltas los maneja cada alumno.
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
    await prisma.generatedWorkout.deleteMany({ where: { athleteId, status: { in: ["PLANNED", "SUGGESTED"] }, date: { gte: block.startDate, lt: block.endDate } } });
    await prisma.weeklyReview.deleteMany({ where: { trainingBlockId: id } });
    await prisma.trainingBlock.delete({ where: { id } });
    refresh(athleteId);
  } catch (e) {
    return { error: e instanceof Error && e.message ? e.message : "No se pudo eliminar el bloque." };
  }
}
