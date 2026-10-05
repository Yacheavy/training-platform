import type { CSSProperties, ReactNode } from "react";

/** Tarjeta estándar del tablero: título, explicación opcional y contenido. */
export function Card({
  title,
  subtitle,
  action,
  children,
  style,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section className="dash-card" style={style}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: subtitle ? "4px" : "14px" }}>
        <h3 className="dash-card-title">{title}</h3>
        {action}
      </div>
      {subtitle && <div className="dash-card-sub">{subtitle}</div>}
      {children}
    </section>
  );
}

/** Encabezado de sección que ordena el tablero (Hoy, Recuperación, …). */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="dash-section">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
