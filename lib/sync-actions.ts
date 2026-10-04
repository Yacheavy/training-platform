"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { syncIntervals } from "@/lib/intervals-sync";

export async function syncNow() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  await syncIntervals(session.user.id, 14);
  revalidatePath("/dashboard");
}
