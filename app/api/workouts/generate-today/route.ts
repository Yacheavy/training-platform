import { generateTodayWorkout } from "@/lib/training-engine/generate-workout";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const forceDayParam = searchParams.get("day"); // 0=domingo..6=sábado, opcional

  const result = await generateTodayWorkout(
    session.user.id,
    forceDayParam ? Number(forceDayParam) : undefined
  );
  return NextResponse.json(result);
}