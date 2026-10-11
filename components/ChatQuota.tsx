import { quotaState } from "@/lib/chat/usage-summary";

const COLORS = { ok: "var(--teal)", low: "var(--amber)", out: "var(--red)" } as const;

/** Medidor visual de los mensajes del día: usados, restantes y barra de progreso. */
export function ChatQuota({ used, limit, compact = false }: { used: number; limit: number; compact?: boolean }) {
  const q = quotaState(used, limit);
  const color = COLORS[q.tone];
  const headline = q.tone === "out" ? "Llegaste al límite de hoy" : `Te quedan ${q.left} ${q.left === 1 ? "mensaje" : "mensajes"} hoy`;
  return (
    <div
      role="group"
      aria-label={`Mensajes del chat de hoy: ${q.used} de ${limit} usados, ${q.left} restantes`}
      style={{ background: "var(--surface)", border: `1px solid ${q.tone === "ok" ? "var(--border)" : color}`, borderRadius: "12px", padding: compact ? "10px 12px" : "12px 14px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ fontSize: compact ? "12.5px" : "14px", fontWeight: 600, color: q.tone === "ok" ? "var(--text)" : color }}>{headline}</div>
        <div style={{ fontSize: compact ? "12px" : "13px", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
          <b style={{ color: "var(--text)", fontSize: compact ? "14px" : "17px" }}>{q.used}</b> / {limit} usados
        </div>
      </div>
      <div style={{ height: compact ? "6px" : "8px", background: "var(--border)", borderRadius: "99px", marginTop: "8px", overflow: "hidden" }} aria-hidden>
        <div style={{ width: `${q.pct}%`, height: "100%", background: color, borderRadius: "99px", transition: "width .3s ease" }} />
      </div>
      {!compact && <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "6px" }}>Se renuevan todos los días a la medianoche.</div>}
    </div>
  );
}
