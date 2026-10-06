import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { syncIntervals } from "@/lib/intervals-sync";
import { NextResponse } from "next/server";

export const maxDuration = 60;

/** Sync incremental. Lo llama el cron diario (Authorization: Bearer CRON_SECRET) o el usuario logueado. */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = !!cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`;

  if (isCron) {
    const users = await prisma.user.findMany({ where: { OR: [{ intervalsApiKeyEncrypted: { not: null } }, { role: "COACH" }] }, select: { id: true } });
    const results = [];
    for (const u of users) {
      try {
        results.push(await syncIntervals(u.id, 14));
      } catch (err) {
        results.push({ activities: 0, wellness: 0, errors: [`Usuario ${u.id}: ${String(err)}`] });
      }
    }
    return NextResponse.json({ cron: true, results });
  }

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get("days")) || 14, 1), 30);
  return NextResponse.json(await syncIntervals(session.user.id, days));
}
