import { getCoachUsageOverview } from "@/lib/chat/usage-overview";

const usd = (n: number) => `US$ ${n < 1 ? n.toFixed(3) : n.toFixed(2)}`.replace(".", ",");
const num = (n: number) => n.toLocaleString("es-AR");

/** Consumo de IA de toda la app para el entrenador: tokens y dinero estimado, total y por alumno. */
export async function AiUsageCard() {
  const u = await getCoachUsageOverview();
  const maxDay = Math.max(0.0001, ...u.daily.map((d) => d.costUsd));
  const tiles = [
    { label: "Hoy", t: u.today },
    { label: "Últimos 7 días", t: u.last7 },
    { label: "Este mes", t: u.month },
    { label: "Total histórico", t: u.total },
  ];
  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 18px" } as const;
  return (
    <div style={{ ...card, marginBottom: "20px" }}>
      <h2 className="card-title">Consumo de la IA</h2>
      <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
        Tokens y dinero estimado del chat y los análisis, de vos y de todos tus alumnos.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", marginBottom: "14px" }}>
        {tiles.map(({ label, t }) => (
          <div key={label} style={{ background: "var(--bg, transparent)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 12px" }}>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{label}</div>
            <div style={{ fontSize: "19px", fontWeight: 700, margin: "2px 0", fontVariantNumeric: "tabular-nums" }}>{usd(t.costUsd)}</div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{num(t.tokens)} tokens · {num(t.messages)} respuestas</div>
          </div>
        ))}
      </div>

      {u.monthProjectionUsd != null && (
        <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "12px" }}>
          Al ritmo de este mes, cerrarías en <b style={{ color: "var(--text)" }}>{usd(u.monthProjectionUsd)}</b> (proyección simple, no es un tope).
        </div>
      )}

      <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "6px" }}>Gasto por día (últimos 14 días)</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "56px", marginBottom: "4px" }} aria-hidden>
        {u.daily.map((d) => (
          <div key={d.dateKey} title={`${d.dateKey}: ${usd(d.costUsd)} · ${d.messages} respuestas`} style={{ flex: 1, height: `${Math.max(d.costUsd > 0 ? 6 : 2, (d.costUsd / maxDay) * 100)}%`, background: d.costUsd > 0 ? "var(--teal)" : "var(--border)", borderRadius: "3px 3px 0 0", opacity: d.costUsd > 0 ? 0.85 : 0.6 }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "var(--text-dim)", marginBottom: "14px" }}>
        <span>{u.daily[0].dateKey.slice(5)}</span><span>hoy</span>
      </div>

      {u.perStudent.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px", minWidth: "420px" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", textAlign: "right" }}>
                <th style={{ textAlign: "left", fontWeight: 500, padding: "4px 6px 4px 0" }}>Persona</th>
                <th style={{ fontWeight: 500, padding: "4px 6px" }}>Hoy</th>
                <th style={{ fontWeight: 500, padding: "4px 6px" }}>Mes</th>
                <th style={{ fontWeight: 500, padding: "4px 6px" }}>% del mes</th>
                <th style={{ fontWeight: 500, padding: "4px 0 4px 6px" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {u.perStudent.map((s) => (
                <tr key={s.athleteId} style={{ borderTop: "1px solid var(--border)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  <td style={{ textAlign: "left", padding: "6px 6px 6px 0" }}>{u.names[s.athleteId] ?? "—"}</td>
                  <td style={{ padding: "6px" }}>{s.today.messages} · {usd(s.today.costUsd)}</td>
                  <td style={{ padding: "6px" }}>{s.month.messages} · {usd(s.month.costUsd)}</td>
                  <td style={{ padding: "6px" }}>{u.month.costUsd > 0 ? `${Math.round((s.month.costUsd / u.month.costUsd) * 100)} %` : "—"}</td>
                  <td style={{ padding: "6px 0 6px 6px" }}>{usd(s.total.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: "11px", color: "var(--text-dim)", margin: "12px 0 0", lineHeight: 1.5 }}>
        Es una estimación calculada con los tokens de cada respuesta y el precio del modelo: el gasto real se confirma en la consola de Anthropic.
        {u.unmeteredReplies > 0 && ` ${u.unmeteredReplies} respuestas anteriores al contador no tienen costo registrado y no se suman.`}
      </p>
    </div>
  );
}
