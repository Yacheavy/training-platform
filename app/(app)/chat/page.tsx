import { auth } from "@/auth";
import { syncIfStale } from "@/lib/intervals-sync";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sendChatMessage } from "@/lib/chat-actions";
import { ChatView, type ChatFocus } from "@/components/ChatView";
import { STIMULUS_LABELS } from "@/lib/labels";
import { ATHLETE_TZ } from "@/lib/tz";
import { getChatUsage } from "@/lib/chat/usage";

const fmtMin = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
};
const fmtDate = (d: Date, tz: string = ATHLETE_TZ) => d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: tz });

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ workoutId?: string; activityId?: string; analyze?: string }> }) {
  const { workoutId, activityId, analyze } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await syncIfStale(session.user.id);

  // Últimos 50 mensajes, en orden cronológico
  const recent = await prisma.chatMessage.findMany({
    where: { athleteId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const messages = recent.reverse().map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString() }));

  // Tarjeta de contexto: deja a la vista de qué sesión se está hablando y que el asistente ya tiene sus datos
  let focus: ChatFocus | undefined;
  if (workoutId) {
    const w = await prisma.generatedWorkout.findFirst({ where: { id: workoutId, athleteId: session.user.id } });
    if (w) {
      const totalSec = (w.blocksJson as unknown as { durationSec: number }[]).reduce((s, b) => s + (b.durationSec ?? 0), 0);
      const editable = w.status !== "COMPLETED";
      focus = {
        kind: "workout",
        tag: "Sesión de tu plan",
        title: STIMULUS_LABELS[w.workoutLibraryKey] ?? w.workoutLibraryKey,
        meta: [fmtDate(w.date, "UTC"), fmtMin(totalSec), w.estimatedTss != null ? `TSS ${Math.round(w.estimatedTss)}` : null].filter(Boolean).join(" · "),
        href: `/workouts/${w.id}`,
        linkLabel: "Ver sesión",
        suggestions: editable
          ? [
              { label: "¿Por qué esta sesión?", prompt: `Explicame por qué me toca esta sesión (${STIMULUS_LABELS[w.workoutLibraryKey] ?? w.workoutLibraryKey}, ${fmtDate(w.date, "UTC")}) y cómo ejecutarla.` },
              { label: "Hacela más corta", prompt: "Hacé esta sesión 15 minutos más corta manteniendo el estímulo principal." },
              { label: "Bajale la intensidad", prompt: "Bajale un poco la intensidad a esta sesión y explicame qué pierdo." },
              { label: "Estoy cansado", prompt: "Hoy estoy cansado: ¿cómo adapto esta sesión?" },
            ]
          : [
              { label: "Explicame la sesión", prompt: "Explicame esta sesión." },
              { label: "¿Cómo me fue?", prompt: "¿Cómo me fue respecto al plan?" },
            ],
      };
    }
  } else if (activityId) {
    const a = await prisma.activity.findFirst({
      where: { id: activityId, athleteId: session.user.id },
      include: { generatedWorkout: { select: { id: true } } },
    });
    if (a) {
      focus = {
        kind: "activity",
        tag: "Sesión realizada",
        title: a.name ?? a.type,
        meta: [fmtDate(a.date), fmtMin(a.durationSec), a.tss != null ? `TSS ${Math.round(a.tss)}` : null, a.normalizedPower ? `NP ${Math.round(a.normalizedPower)} W` : null].filter(Boolean).join(" · "),
        href: `/activities/${a.id}`,
        linkLabel: "Ver actividad",
        suggestions: [
          { label: "Analizá la sesión", prompt: `Analizá esta sesión (${a.name ?? a.type}, ${fmtDate(a.date)}): contame cómo salió y qué sigue.` },
          ...(a.generatedWorkout ? [{ label: "¿Cumplí el plan?", prompt: "¿Cumplí con lo planificado en esta sesión? Compará lo hecho contra lo previsto." }] : []),
          { label: "Impacto en recuperación", prompt: "¿Cómo impacta esta sesión en mi recuperación?" },
          { label: "¿Qué hago mañana?", prompt: "Según esta sesión, ¿qué debería hacer mañana?" },
        ],
      };
    }
  }

  const usage = await getChatUsage(session.user.id);
  return <ChatView usage={usage} messages={messages} workoutId={focus?.kind === "workout" ? workoutId : undefined} activityId={focus?.kind === "activity" ? activityId : undefined} focus={focus} autoAnalyze={analyze === "1" && focus?.kind === "activity"} action={sendChatMessage} />;
}
