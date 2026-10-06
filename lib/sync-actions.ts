"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { syncIntervals } from "@/lib/intervals-sync";

export async function syncNow() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const r = await syncIntervals(session.user.id, 14);
  if (r.errors.length > 0 && r.activities === 0 && r.wellness === 0) {
    throw new Error(/401|403|unauthor/i.test(r.errors[0]) ? "Intervals rechazó tu API key: revisala en Ajustes" : r.errors[0].slice(0, 160));
  }
  revalidatePath("/dashboard");
}
