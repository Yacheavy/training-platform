import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function requireCoachId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "COACH") throw new Error("Solo el entrenador puede hacer esto");
  return session.user.id;
}
