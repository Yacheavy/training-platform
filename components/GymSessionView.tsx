import type { GymSession, ExCategory } from "@/lib/training-engine/strength";
import { REFERENCES } from "@/lib/chat/references";

const CAT: Record<ExCategory, { label: string; color: string }> = {
  fuerza: { label: "Fuerza", color: "#B79BEF" },
  potencia: { label: "Potencia", color: "#F0A35E" },
  core: { label: "Core", color: "#5BDDD1" },
  propiocepcion: { label: "Propiocepción", color: "#6FA8DC" },
};

const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "16px" } as const;
const h = { fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px" } as const;
const small = { fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6 } as const;

const fmtRest = (s: number) => (s >= 90 ? `${Math.round((s / 60) * 2) / 2} min` : `${s} s`);

/** Detalle de una sesión de gimnasio o de flexibilidad: entrada en calor, ejercicios, flexibilidad, notas y evidencia. */
export function GymSessionView({ gym }: { gym: GymSession }) {
  const refText = (id: string) => REFERENCES.find((r) => r.id === id)?.cite ?? id;
  return (
    <>
      {gym.summary && (
        <div style={card}>
          <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "6px" }}>{gym.title}</div>
          <div style={small}>{gym.summary}</div>
        </div>
      )}

      {gym.warmup.length > 0 && (
        <div style={card}>
          <div style={h}>{gym.role === "movilidad" ? "Antes de empezar" : "Entrada en calor"}</div>
          <ul style={{ margin: 0, paddingLeft: "18px", ...small }}>
            {gym.warmup.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {gym.exercises.length > 0 && (
        <div style={card}>
          <div style={h}>Trabajo principal</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {gym.exercises.map((e, i) => (
              <div key={`${e.id}-${i}`} style={{ borderLeft: `3px solid ${CAT[e.category].color}`, paddingLeft: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "baseline", flexWrap: "wrap" }}>
                  <div style={{ fontSize: "13.5px", fontWeight: 600 }}>{i + 1}. {e.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", whiteSpace: "nowrap" }}>{e.sets} × {e.reps}</div>
                </div>
                <div style={{ fontSize: "11px", color: CAT[e.category].color, margin: "2px 0 4px" }}>
                  {CAT[e.category].label} · pausa {fmtRest(e.restSec)}
                </div>
                <div style={small}>{e.cue}</div>
                <div style={{ ...small, color: "var(--text-dim)" }}>{e.load}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {gym.mobility.length > 0 && (
        <div style={card}>
          <div style={h}>{gym.role === "movilidad" ? "Set de flexibilidad" : "Flexibilidad (al final)"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {gym.mobility.map((m) => (
              <div key={m.name}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>{m.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)" }}>{m.hold}</span>
                </div>
                <div style={small}>{m.cue}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {gym.notes.length > 0 && (
        <div style={card}>
          <div style={h}>A tener en cuenta</div>
          <ul style={{ margin: 0, paddingLeft: "18px", ...small }}>
            {gym.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      {gym.evidence.length > 0 && (
        <div style={card}>
          <div style={h}>Qué respaldo tiene esto</div>
          <ul style={{ margin: 0, paddingLeft: "18px", ...small }}>
            {gym.evidence.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
          {gym.refs.length > 0 && (
            <details style={{ marginTop: "10px" }}>
              <summary style={{ cursor: "pointer", fontSize: "12px", color: "var(--teal)" }}>Ver fuentes</summary>
              <ul style={{ margin: "8px 0 0", paddingLeft: "18px", fontSize: "11.5px", color: "var(--text-dim)", lineHeight: 1.55 }}>
                {gym.refs.map((r) => <li key={r}><b>{r}</b> · {refText(r)}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </>
  );
}
