import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sendChatMessage } from "@/lib/chat-actions";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ workoutId?: string }> }) {
  const { workoutId } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const messages = await prisma.chatMessage.findMany({
    where: { athleteId: session.user.id },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return (
    <div style={{ padding: "24px 40px", maxWidth: "900px", display: "flex", flexDirection: "column", minHeight: "calc(100vh - 76px)" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "20px" }}>Chat</h1>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              background: m.role === "user" ? "var(--surface-3)" : "rgba(79,209,197,.08)",
              border: m.role === "user" ? "none" : "1px solid var(--teal-dim)",
              borderRadius: "10px",
              padding: "10px 14px",
              maxWidth: "80%",
              fontSize: "13px",
              whiteSpace: "pre-wrap",
            }}
          >
            {m.content}
          </div>
        ))}
        {messages.length === 0 && <div style={{ color: "var(--text-dim)", fontSize: "13px" }}>Sin mensajes todavía — preguntame algo sobre tu entrenamiento.</div>}
      </div>

      <form action={sendChatMessage} style={{ display: "flex", gap: "8px" }}>
        {workoutId && <input type="hidden" name="focusedWorkoutId" value={workoutId} />}
        <input
          name="message"
          placeholder="Escribí tu mensaje..."
          style={{ flex: 1, background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: "9px", color: "var(--text)", padding: "10px 14px", fontSize: "13px" }}
          required
        />
        <button type="submit" style={{ background: "var(--teal)", color: "#0A1310", border: "none", borderRadius: "9px", padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}>
          Enviar
        </button>
      </form>
    </div>
  );
}