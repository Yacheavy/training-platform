"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

/** «Volver» que regresa a la pantalla de donde vino el usuario (calendario, plan, dashboard…); si no hay historial, va a `fallback`. */
export function BackLink({ fallback, children = "← Volver", style }: { fallback: string; children?: ReactNode; style?: CSSProperties }) {
  const router = useRouter();
  return (
    <a
      href={fallback}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      style={{ display: "inline-block", padding: "6px 0", color: "var(--teal)", fontSize: "13px", textDecoration: "none", ...style }}
    >
      {children}
    </a>
  );
}
