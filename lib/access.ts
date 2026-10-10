import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function requireCoachId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "COACH") throw new Error("Solo el entrenador puede hacer esto");
  return session.user.id;
}

/** Regla de pertenencia (pura, se prueba aparte): el alumno no es un coach ni el propio entrenador y fue invitado por él (o por una invitación antigua sin dueño). */
export function coachCanManage(i: { coachId: string; student: { id: string; role: string } | null; invite: { invitedById: string | null } | null }): boolean {
  if (!i.student || i.student.role === "COACH" || i.student.id === i.coachId) return false;
  return !!i.invite && (i.invite.invitedById === i.coachId || i.invite.invitedById === null);
}

/** El entrenador solo puede ver a alumnos que él invitó (o invitaciones antiguas sin dueño). Devuelve el alumno o lanza error. */
export async function requireCoachOfStudent(studentId: string) {
  const coachId = await requireCoachId();
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, email: true, role: true, ftp: true, pvo2maxWatts: true, intervalsLastSyncAt: true, intervalsAthleteId: true },
  });
  const invite = student
    ? await prisma.allowedEmail.findFirst({ where: { email: student.email, OR: [{ invitedById: coachId }, { invitedById: null }] }, select: { invitedById: true } })
    : null;
  if (!student || !coachCanManage({ coachId, student, invite })) throw new Error("Alumno no encontrado");
  return student;
}
