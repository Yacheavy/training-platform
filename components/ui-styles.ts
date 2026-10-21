import type { CSSProperties } from "react";

/**
 * Estilos de formulario y botones compartidos por Ajustes, Plan, Alimentación y el asistente.
 * Todo sale de las variables de diseño (globals.css): si cambia la paleta o el radio, cambia en toda la app.
 */
export const labelStyle: CSSProperties = { display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" };

export const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--surface-3)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-md)",
  color: "var(--text)",
  padding: "11px 13px",
  fontSize: "15px",
  outline: "none",
};

/** Botón principal (turquesa con degradé) */
export const btnStyle: CSSProperties = {
  background: "linear-gradient(135deg, #5BDDD1, #3DB8AD)",
  color: "#08201C",
  border: "none",
  borderRadius: "var(--r-md)",
  padding: "10px 18px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 6px 16px -10px rgba(79, 209, 197, 0.7)",
};

/** Botón secundario (con borde, sin relleno); el color del texto se puede cambiar según el caso */
export const btnGhostStyle: CSSProperties = {
  ...btnStyle,
  background: "transparent",
  color: "var(--text-muted)",
  border: "1px solid var(--border-strong)",
  boxShadow: "none",
};

/** Tarjeta de sección */
export const cardStyle: CSSProperties = {
  background: "var(--grad-card)",
  border: "1px solid rgba(255,255,255,.06)",
  boxShadow: "0 1px 0 rgba(255,255,255,.03) inset, 0 8px 24px -12px rgba(0,0,0,.5)",
  borderRadius: "var(--radius)",
  padding: "22px",
  marginBottom: "20px",
};
