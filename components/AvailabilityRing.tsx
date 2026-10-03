export function AvailabilityRing({
  status,
  signalsTriggered,
  reasons,
}: {
  status: "GREEN" | "AMBER" | "RED";
  signalsTriggered: string[];
  reasons: string[];
}) {
  const color = status === "GREEN" ? "#4FD1C5" : status === "AMBER" ? "#E8A33D" : "#E5636A";
  const label = status === "GREEN" ? "Alta" : status === "AMBER" ? "Moderada" : "Baja";
  const signalCount = signalsTriggered.length;

  return (
    <div style={{ maxWidth: "320px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: color, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Disponibilidad
          </div>
          <div style={{ fontSize: "15px", fontWeight: 600, color }}>
            {label} — {signalCount} señal{signalCount !== 1 ? "es" : ""} de alerta
          </div>
        </div>
      </div>
      <div style={{ fontSize: "10.5px", color: "var(--text-dim)", lineHeight: 1.5 }}>
        {reasons.map((r, i) => (
          <div key={i}>• {r}</div>
        ))}
      </div>
    </div>
  );
}