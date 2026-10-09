import { NavLinks } from "@/components/NavLinks";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/Toaster";
import { LogoMark } from "@/components/Logo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  const isCoach = me?.role === "COACH";

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Desktop sidebar */}
      <div
        className="app-sidebar"
        style={{
          display: "none",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          width: "72px",
          background: "linear-gradient(180deg, #171E27, #121821)",
          borderRight: "1px solid rgba(255,255,255,.05)",
          flexDirection: "column",
          alignItems: "center",
          padding: "20px 0",
          gap: "8px",
          zIndex: 10,
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <LogoMark size={54} />
        </div>
        <NavLinks variant="side" isCoach={isCoach} />
      </div>

      {/* Mobile bottom nav */}
      <div
        className="app-bottomnav"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "60px",
          background: "rgba(23,30,39,.92)",
          backdropFilter: "blur(14px)",
          borderTop: "1px solid rgba(255,255,255,.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          zIndex: 10,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <NavLinks variant="bottom" isCoach={isCoach} />
      </div>

      <div className="app-content" style={{ paddingBottom: "76px" }}>
        {children}
      </div>

      <Toaster />

      <style>{`
        @media (min-width: 1024px) {
          .app-sidebar { display: flex !important; }
          .app-bottomnav { display: none !important; }
          .app-content { margin-left: 72px; padding-bottom: 0 !important; }
        }
      `}</style>
    </div>
  );
}