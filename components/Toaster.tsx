"use client";

import { useEffect, useState } from "react";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();
let nextId = 1;

/** Muestra un aviso breve desde cualquier componente cliente. */
export function toast(message: string, kind: ToastKind = "success") {
  const item = { id: nextId++, message, kind };
  listeners.forEach((l) => l(item));
}

const COLORS: Record<ToastKind, string> = {
  success: "var(--teal)",
  error: "#E5636A",
  info: "var(--text-muted)",
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast: Listener = (t) => {
      setItems((prev) => [...prev.slice(-2), t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.kind === "error" ? 6000 : 3200);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "76px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        zIndex: 100,
        pointerEvents: "none",
        padding: "0 16px",
      }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          className="toast-in"
          style={{
            background: "var(--surface-2, #242F3B)",
            border: `1px solid ${COLORS[t.kind]}`,
            color: "var(--text)",
            borderRadius: "10px",
            padding: "10px 16px",
            fontSize: "13px",
            boxShadow: "0 6px 24px rgba(0,0,0,.4)",
            maxWidth: "420px",
          }}
        >
          <span style={{ color: COLORS[t.kind], marginRight: "8px", fontWeight: 700 }}>
            {t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "i"}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
