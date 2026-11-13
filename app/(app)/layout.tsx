import { NavLinks } from "@/components/NavLinks";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/Toaster";
import { LogoMark } from "@/components/Logo";
import { ConsentModal } from "@/components/ConsentModal";
import { acceptConsent } from "@/lib/consent-actions";
import { CONSENT_VERSION, CREATOR } from "@/lib/brand";
import { PostRideModal } from "@/components/PostRideModal";
import { savePostRide } from "@/lib/postride-actions";
import { getPendingPostRide } from "@/lib/nutrition-data";
import { syncIfStale } from "@/lib/intervals-sync";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, consentVersion: true, coach: { select: { name: true } } } });
  const isCoach = me?.role === "COACH";
  const needsConsent = me?.consentVersion !== CONSENT_VERSION;
  // Tras una salida: popup para completar alimentación, RPE y sensación (no se muestra si falta el consentimiento)
  // Se sincroniza ANTES de buscar la salida pendiente: el layout y la página se piden a la vez, y si solo sincronizaba la página, el popup de la salida recién subida no aparecía hasta recargar.
  // syncIfStale comparte la ejecución en curso y no repite si la última sync tiene menos de 5 min.
  if (!needsConsent) await syncIfStale(session.user.id);
  const pendingRide = needsConsent ? null : await getPendingPostRide(session.user.id).catch(() => null);
  const coachName = isCoach ? CREATOR.name : (me?.coach?.name ?? CREATOR.name);

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
          background: "var(--side-bg)",
          borderRight: "1px solid rgba(var(--ink-rgb), .05)",
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

      {/* Mobile bottom nav: barra flotante con íconos */}
      <nav
        className="app-bottomnav"
        aria-label="Navegación principal"
        style={{
          position: "fixed",
          bottom: "calc(10px + env(safe-area-inset-bottom))",
          left: "12px",
          right: "12px",
          maxWidth: "440px",
          margin: "0 auto",
          height: "64px",
          padding: "6px",
          gap: "4px",
          background: "var(--nav-bg)",
          backdropFilter: "blur(18px) saturate(1.4)",
          WebkitBackdropFilter: "blur(18px) saturate(1.4)",
          border: "1px solid rgba(var(--ink-rgb), .1)",
          borderRadius: "24px",
          boxShadow: "0 14px 34px -12px rgba(var(--shadow-rgb), .55), 0 1px 0 rgba(var(--ink-rgb), .05) inset",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-around",
          zIndex: 10,
        }}
      >
        <NavLinks variant="bottom" isCoach={isCoach} />
      </nav>

      <div className="app-content" style={{ paddingBottom: "100px" }}>
        {children}
      </div>

      {pendingRide && <PostRideModal p={pendingRide} action={savePostRide} />}
      {needsConsent && <ConsentModal action={acceptConsent} coachName={coachName} />}
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