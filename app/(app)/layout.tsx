import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/Toaster";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "◆", label: "Hoy" },
  { href: "/settings", icon: "⚙", label: "Ajustes" },
  { href: "/chat", icon: "✉", label: "Chat" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          flexDirection: "column",
          alignItems: "center",
          padding: "20px 0",
          gap: "8px",
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, var(--teal), #2E8B82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            fontSize: "14px",
            color: "#0A1310",
            marginBottom: "24px",
          }}
        >
          i
        </div>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-dim)",
              fontSize: "18px",
              textDecoration: "none",
            }}
          >
            {item.icon}
          </Link>
        ))}
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
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          zIndex: 10,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "3px",
              color: "var(--text-dim)",
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              textDecoration: "none",
            }}
          >
            <span style={{ fontSize: "18px" }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
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