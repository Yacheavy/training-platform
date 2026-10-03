import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { workoutId } = await request.json();

  const workout = await prisma.generatedWorkout.findUnique({ where: { id: workoutId } });
  if (!workout || workout.athleteId !== session.user.id) {
    return NextResponse.json({ error: "Workout no encontrado" }, { status: 404 });
  }

  const updated = await prisma.generatedWorkout.update({
    where: { id: workoutId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  return NextResponse.json(updated);
}