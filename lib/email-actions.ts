"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { mailConfigured, sendMail, smtpDiagnostics } from "@/lib/email/mailer";
import { bodyToHtml, layoutEmail } from "@/lib/email/template";

async function me() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function setEmailAnalysis(formData: FormData) {
  const id = await me();
  await prisma.user.update({ where: { id }, data: { emailAnalysis: formData.get("enabled") === "on" } });
  revalidatePath("/settings");
}

/** Manda un mail de prueba a la propia casilla para verificar la configuración. */
export async function sendTestEmail(): Promise<{ error: string } | void> {
  const id = await me();
  if (!mailConfigured()) return { error: "Falta configurar SMTP_USER y SMTP_PASS en Vercel (y redesplegar)." };
  const u = await prisma.user.findUnique({ where: { id }, select: { email: true, name: true } });
  if (!u) return { error: "Usuario no encontrado" };
  try {
    await sendMail({
      to: u.email,
      subject: "Prueba de mail de Overkill Cycling",
      html: layoutEmail({
        title: "Los mails funcionan",
        subtitle: "Mail de prueba",
        bodyHtml: bodyToHtml(`Hola${u.name ? ` ${u.name.split(" ")[0]}` : ""}. Si estás leyendo esto, la app ya puede enviarte el análisis de tus salidas.`),
        ctaLabel: "Abrir la app",
        ctaPath: "/dashboard",
      }),
      text: "Los mails funcionan. Si estás leyendo esto, la app ya puede enviarte el análisis de tus salidas.",
    });
  } catch (e) {
    const err = e as { code?: string; responseCode?: number; message?: string };
    console.error("sendTestEmail falló", e, smtpDiagnostics());
    if (err.code === "EAUTH" || err.responseCode === 535) {
      return { error: "Gmail rechazó el usuario o la contraseña de aplicación (error 535). Revisá que la contraseña sea de la cuenta overkillcycling@gmail.com, sin espacios, y que hayas redesplegado." };
    }
    return { error: `No se pudo enviar: ${err.message ?? "error desconocido"}` };
  }
}
