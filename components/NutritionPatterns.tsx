import type { NutritionSummary } from "@/lib/training-engine/nutrition-analysis";

/** Resumen de nutrición intra-entrenamiento y patrones contra rendimiento (últimas semanas). */
export function NutritionPatterns({ summary }: { summary: NutritionSummary }) {
  if (summary.eligible === 0) {
    return <div style={{ fontSize: "12.5px", color: "var(--text-dim)" }}>Todavía no hay sesiones de 1 h o más en las últimas {Math.round(summary.windowDays / 7)} semanas.</div>;
  }
  const stat = (v: string, l: string) => (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "18px", fontWeight: 600 }}>{v}</div>
      <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: "2px" }}>{l}</div>
    </div>
  );
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "14px", marginBottom: "12px" }}>
        {stat(`${summary.logged}/${summary.eligible}`, "sesiones registradas")}
        {stat(summary.avgCarbsPerHour != null ? `${Math.round(summary.avgCarbsPerHour)} g/h` : "—", "CHO promedio")}
        {stat(summary.avgTargetPerHour != null ? `${Math.round(summary.avgTargetPerHour)} g/h` : "—", "CHO sugerido")}
        {stat(summary.avgFluidPerHour != null ? `${Math.round(summary.avgFluidPerHour)} ml/h` : "—", "líquido (≥90 min)")}
      </div>
      {summary.insights.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12.5px", lineHeight: 1.55, color: "var(--text-muted)" }}>
          {summary.insights.map((i) => <li key={i}>{i}</li>)}
        </ul>
      ) : (
        <div style={{ fontSize: "12.5px", color: "var(--text-dim)" }}>Aún no hay suficientes registros para detectar patrones.</div>
      )}
      <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "10px" }}>
        Objetivos de CHO según duración e intensidad (Jeukendrup 2014; ACSM 2016). Las diferencias son asociaciones, no causas.
      </div>
    </div>
  );
}
