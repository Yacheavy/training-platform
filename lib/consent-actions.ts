"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { CONSENT_VERSION } from "@/lib/brand";

export async function acceptConsent(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");
  if (formData.get("accept") !== "on") throw new Error("Tenés que marcar la casilla para continuar.");
  await prisma.user.update({ where: { id: session.user.id }, data: { consentAcceptedAt: new Date(), consentVersion: CONSENT_VERSION } });
  revalidatePath("/", "layout");
}
