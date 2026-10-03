import { updateAthleteResponseProfile } from "@/lib/training-engine/response-profile";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const results = await updateAthleteResponseProfile(session.user.id);
  return NextResponse.json(results);
}