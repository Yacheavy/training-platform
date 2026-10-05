import { generateFullPlan } from "@/lib/training-engine/generate-full-plan";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const trainingBlockId = searchParams.get("blockId");
  if (!trainingBlockId) {
    return NextResponse.json({ error: "Falta el parámetro blockId" }, { status: 400 });
  }

  const result = await generateFullPlan(trainingBlockId, { athleteId: session.user.id });
  return NextResponse.json(result);
}