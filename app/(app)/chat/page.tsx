import { auth } from "@/auth";
import { syncIfStale } from "@/lib/intervals-sync";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sendChatMessage } from "@/lib/chat-actions";
import { ChatView } from "@/components/ChatView";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ workoutId?: string }> }) {
  const { workoutId } = await searchParams;
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

  return <ChatView messages={messages} workoutId={workoutId} action={sendChatMessage} />;
}
