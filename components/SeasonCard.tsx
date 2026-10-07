import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";
import type { SeasonState } from "@/lib/season-data";

const OBJ_LABEL: Record<string, string> = { base: "Base", umbral: "Umbral", vo2max: "VO2max", tapering: "Puesta a punto" };
const OBJ_COLOR: Record<string, string> = { vo2max: "#E5636A", umbral: "#E8A33D", base: "#4FD1C5", tapering: "#6FA8DC" };
const fmtKey = (k: string) => new Date(k + "T00:00:00Z").toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Temporada: objetivo principal, bloques actuales y propuesta para llegar a la fecha (el cálculo es puro, se muestra antes de aplicar). */
export function SeasonCard({
  state,
  applyAction,
  deleteAction,
  cardStyle,
}: {
  state: SeasonState;
  applyAction: (formData: FormData) => Promise<unknown>;
  deleteAction: (formData: FormData) => Promise<unknown>;
  cardStyle: React.CSSProperties;
}) {
  const { goal, existing, proposal, periodization } = state;
  const chip = (obj: string) => (
    <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: OBJ_COLOR[obj] ?? "var(--text-dim)", marginRight: "8px" }} />
  );
  return (
    <div style={cardStyle}>
      <h2 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 4px" }}>Temporada</h2>
      <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "0 0 16px" }}>
        La app propone los bloques que faltan para llegar a tu objetivo principal (prioridad A, el más cercano). El orden de las fases es
        convención de práctica: no hay ensayos que respalden un orden o un modelo de periodización sobre otro en ciclistas entrenados.
      </p>

      <div style={{ fontSize: "13px", marginBottom: "14px" }}>
        {goal ? (
          <>
            <b>Objetivo:</b> {goal.name} · {fmtKey(goal.dateKey)} (prioridad {goal.priority})
          </>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>Todavía no hay un objetivo con fecha. Cargá uno arriba y la app arma la temporada.</span>
        )}
      </div>

      {existing.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "8px" }}>Bloques actuales</div>
          {existing.map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px", marginBottom: "6px", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: "200px" }}>
                {chip(b.objective)}
                <b>{OBJ_LABEL[b.objective] ?? b.objective}</b> · {fmtKey(b.startKey)} → {fmtKey(b.endKey)}
              </span>
              {b.isFuture && (
                <ActionForm action={deleteAction} success="Bloque eliminado">
                  <input type="hidden" name="blockId" value={b.id} />
                  <SubmitButton style={{ background: "transparent", border: "1px solid #2A3441", color: "#E7ECF2", borderRadius: "8px", padding: "4px 10px", fontSize: "11.5px", cursor: "pointer" }}>Eliminar</SubmitButton>
                </ActionForm>
              )}
            </div>
          ))}
        </div>
      )}

      {!proposal.covered && proposal.blocks.length > 0 && (
        <div style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "8px" }}>Propuesta</div>
          {proposal.blocks.map((b) => (
            <div key={b.startKey} style={{ marginBottom: "10px", fontSize: "12.5px" }}>
              <div>
                {chip(b.objective)}
                <b>{OBJ_LABEL[b.objective]}</b> · {b.weeks} semana{b.weeks === 1 ? "" : "s"} · {fmtKey(b.startKey)} → {fmtKey(b.endKey)}
              </div>
              <div style={{ color: "var(--text-muted)", marginLeft: "16px" }}>{b.why}</div>
            </div>
          ))}
        </div>
      )}

      {proposal.notes.length > 0 && (
        <ul style={{ margin: "0 0 14px", paddingLeft: "18px", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 }}>
          {proposal.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px" }}>
        Periodización: <b style={{ color: "var(--text)" }}>{periodization === "block" ? "por bloques" : "lineal"}</b> (se cambia en «Reglas de recuperación y planificación»).
        {periodization === "block" && " En los bloques de VO2max, la primera semana de cada mesociclo lleva 2 sesiones de VO2max y las demás 1."}
      </div>

      {!proposal.covered && proposal.blocks.length > 0 && (
        <ActionForm action={applyAction} success="Temporada creada: bloques y sesiones generados">
          <SubmitButton pendingText="Creando bloques…" style={{ background: "var(--teal)", color: "#08201C", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600 }}>
            Crear estos bloques y generar las sesiones
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
