const OBJECTIVE_COLORS: Record<string, string> = {
  vo2max: "#E5636A",
  umbral: "#E8A33D",
  base: "#4FD1C5",
  tapering: "#6FA8DC",
};

export function PhaseTimeline({
  blocks,
}: {
  blocks: { id: string; name: string; objective: string; startDate: string; endDate: string }[];
}) {
  if (blocks.length === 0) {
    return (
      <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>
        No hay bloques de entrenamiento configurados todavía.
      </div>
    );
  }

  const minDate = new Date(blocks[0].startDate).getTime();
  const maxDate = Math.max(...blocks.map((b) => new Date(b.endDate).getTime()));
  const totalSpan = maxDate - minDate || 1;
  const today = Date.now();

  return (
    <div>
      <div style={{ position: "relative", height: "44px" }}>
        <div style={{ position: "absolute", top: "20px", left: 0, right: 0, height: "4px", background: "var(--surface-2)", borderRadius: "2px" }} />
        {blocks.map((b) => {
          const start = new Date(b.startDate).getTime();
          const end = new Date(b.endDate).getTime();
          const left = ((start - minDate) / totalSpan) * 100;
          const width = ((end - start) / totalSpan) * 100;
          return (
            <div
              key={b.id}
              title={b.name}
              style={{
                position: "absolute",
                top: "20px",
                left: `${left}%`,
                width: `${width}%`,
                height: "4px",
                borderRadius: "2px",
                background: OBJECTIVE_COLORS[b.objective] ?? "var(--text-dim)",
              }}
            />
          );
        })}
        {today >= minDate && today <= maxDate && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              left: `${((today - minDate) / totalSpan) * 100}%`,
              width: "2px",
              height: "28px",
              background: "var(--text)",
              opacity: 0.6,
            }}
          />
        )}
      </div>
      <div style={{ display: "flex", gap: "16px", marginTop: "8px", flexWrap: "wrap" }}>
        {blocks.map((b) => (
          <div key={b.id} style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: OBJECTIVE_COLORS[b.objective] ?? "var(--text-dim)" }}>
            {b.name} ({new Date(b.startDate).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} - {new Date(b.endDate).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })})
          </div>
        ))}
      </div>
    </div>
  );
}