import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function requireCoachId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "COACH") throw new Error("Solo el entrenador puede hacer esto");
  return session.user.id;
}

/** El entrenador solo puede ver a alumnos que él invitó (o invitaciones antiguas sin dueño). Devuelve el alumno o lanza error. */
export async function requireCoachOfStudent(studentId: string) {
  const coachId = await requireCoachId();
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, email: true, role: true, ftp: true, pvo2maxWatts: true, intervalsLastSyncAt: true, intervalsAthleteId: true },
  });
  if (!student || student.role === "COACH" || student.id === coachId) throw new Error("Alumno no encontrado");
  const invite = await prisma.allowedEmail.findFirst({
    where: { email: student.email, OR: [{ invitedById: coachId }, { invitedById: null }] },
    select: { email: true },
  });
  if (!invite) throw new Error("Alumno no encontrado");
  return student;
}
