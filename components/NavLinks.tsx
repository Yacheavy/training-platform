"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  "/dashboard": (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  "/planificacion": (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2.2" />
      <path d="M3 9.5h18M8 3v3M16 3v3" />
      <path d="M7.5 14h3M13.5 14h3M7.5 17.2h3" />
    </>
  ),
  "/chat": <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  "/settings": (
    <>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1 14h6M9 8h6M17 16h6" />
    </>
  ),
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Hoy" },
  { href: "/planificacion", label: "Plan" },
  { href: "/chat", label: "Chat" },
  { href: "/settings", label: "Ajustes" },
];

function Icon({ href, size }: { href: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[href]}
    </svg>
  );
}

/** Navegación con ícono + estado activo. variant: barra lateral (desktop) o inferior (celular). */
export function NavLinks({ variant }: { variant: "side" | "bottom"; isCoach?: boolean }) {
  const pathname = usePathname();
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/") || (item.href === "/dashboard" && (pathname.startsWith("/workouts") || pathname.startsWith("/activities"))) || (item.href === "/planificacion" && pathname.startsWith("/calendar")) || (item.href === "/settings" && pathname.startsWith("/alumnos"));
        if (variant === "side") {
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="nav-link"
              style={{
                width: "52px",
                padding: "8px 0 6px",
                borderRadius: "10px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                color: active ? "var(--teal)" : "var(--text-dim)",
                background: active ? "rgba(79,209,197,.1)" : "transparent",
                textDecoration: "none",
                fontSize: "9.5px",
                fontFamily: "var(--font-mono)",
              }}
            >
              <Icon href={item.href} size={20} />
              {item.label}
            </Link>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="nav-link"
            style={{
              flex: 1,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "3px",
              color: active ? "var(--teal)" : "var(--text-dim)",
              borderTop: `2px solid ${active ? "var(--teal)" : "transparent"}`,
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              textDecoration: "none",
            }}
          >
            <Icon href={item.href} size={22} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
