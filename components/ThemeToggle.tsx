"use client";

import { useState } from "react";

type Theme = "dark" | "light" | "auto";
const OPTIONS: { value: Theme; label: string; hint: string }[] = [
  { value: "dark", label: "Oscuro", hint: "El de siempre" },
  { value: "light", label: "Claro", hint: "Fondo blanco" },
  { value: "auto", label: "Automático", hint: "Sigue al celular" },
];

/** Elegir la apariencia. Se guarda en una cookie (la lee el servidor para pintar la página con el tema correcto desde el primer momento). */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [value, setValue] = useState<Theme>(initial);
  function pick(t: Theme) {
    setValue(t);
    try {
      document.cookie = `theme=${t}; path=/; max-age=31536000; samesite=lax`;
    } catch { /* sin cookies: queda en esta sesión */ }
    document.documentElement.dataset.theme = t;
    // los gráficos de canvas leen el tema al cargar: se recarga para que cambien también
    window.setTimeout(() => window.location.reload(), 120);
  }
  return (
    <div role="radiogroup" aria-label="Apariencia" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
      {OPTIONS.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => pick(o.value)}
            style={{
              textAlign: "left",
              padding: "12px 12px",
              borderRadius: "14px",
              border: `1.5px solid ${on ? "var(--teal)" : "var(--border)"}`,
              background: on ? "rgba(var(--teal-rgb), .1)" : "var(--surface-2)",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: "13.5px", fontWeight: 700, color: on ? "var(--teal)" : "var(--text)" }}>{o.label}</div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>{o.hint}</div>
          </button>
        );
      })}
    </div>
  );
}
