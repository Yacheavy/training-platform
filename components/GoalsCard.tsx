"use client";

import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";

export interface GoalRow {
  id: string;
  goalType: "EVENT" | "PERFORMANCE";
  name: string;
  eventDate: string | null; // YYYY-MM-DD
  priority: "A" | "B" | "C";
  metric: string | null;
  baselineValue: number | null;
  targetValue: number | null;
}

const PRIORITY: Record<string, { label: string; desc: string; color: string }> = {
  A: { label: "A · Principal", desc: "El objetivo de la temporada", color: "var(--red)" },
  B: { label: "B · Importante", desc: "Suma, pero no se sacrifica todo", color: "var(--amber)" },
  C: { label: "C · De preparación", desc: "Sirve como entrenamiento", color: "var(--blue)" },
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function daysUntil(dateKey: string, todayKey: string): number {
  return Math.round((new Date(dateKey + "T00:00:00Z").getTime() - new Date(todayKey + "T00:00:00Z").getTime()) / 86400000);
}

function countdown(n: number): string {
  if (n === 0) return "es hoy";
  if (n === 1) return "es mañana";
  if (n === -1) return "fue ayer";
  if (n < 0) return `hace ${-n} días`;
  if (n >= 14) return `faltan ${Math.round(n / 7)} semanas (${n} días)`;
  return `faltan ${n} días`;
}

export function GoalsCard({
  goals,
  todayKey,
  currentFtp,
  addAction,
  deleteAction,
  cardStyle,
}: {
  goals: GoalRow[];
  todayKey: string;
  currentFtp: number | null;
  addAction: (formData: FormData) => Promise<unknown>;
  deleteAction: (formData: FormData) => Promise<unknown>;
  cardStyle: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"EVENT" | "PERFORMANCE">("EVENT");

  const events = goals.filter((g) => g.goalType === "EVENT").sort((a, b) => (a.eventDate ?? "9999").localeCompare(b.eventDate ?? "9999"));
  const perf = goals.filter((g) => g.goalType === "PERFORMANCE");

  const DeleteButton = ({ id }: { id: string }) => (
    <ActionForm action={deleteAction} success="Objetivo eliminado" confirm="¿Quitar este objetivo?">
      <input type="hidden" name="id" value={id} />
      <SubmitButton style={{ background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border-strong)", borderRadius: "8px", padding: "5px 10px", fontSize: "12px" }}>
        Quitar
      </SubmitButton>
    </ActionForm>
  );

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "4px" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 4px" }}>Objetivos</h2>
          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: 0 }}>
            Carreras y metas que orientan tu plan. La prioridad indica cuánto se organiza el entrenamiento alrededor de cada una.
          </p>
        </div>
        {!open && (
          <button type="button" className="btn" onClick={() => setOpen(true)} style={{ background: "var(--teal)", color: "#08201C", border: "none", borderRadius: "10px", padding: "9px 14px", fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer" }}>
            Agregar objetivo
          </button>
        )}
      </div>

      {goals.length === 0 && !open && (
        <div style={{ border: "1px dashed var(--border)", borderRadius: "12px", padding: "22px", textAlign: "center", marginTop: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>Todavía no tenés objetivos</div>
          <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>Cargá una carrera con fecha o una meta como subir tu FTP, y el plan se arma hacia ella.</div>
        </div>
      )}

      {events.length > 0 && (
        <div style={{ marginTop: "18px" }}>
          <h3 className="group-title" style={{ marginBottom: "10px" }}>Eventos</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {events.map((g) => {
              const n = g.eventDate ? daysUntil(g.eventDate, todayKey) : null;
              const [, mm, dd] = (g.eventDate ?? "").split("-");
              const p = PRIORITY[g.priority];
              return (
                <div key={g.id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface-2)", opacity: n != null && n < 0 ? 0.6 : 1 }}>
                  <div style={{ width: "48px", textAlign: "center", flexShrink: 0 }}>
                    {g.eventDate ? (
                      <>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 600, lineHeight: 1 }}>{Number(dd)}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>{MONTHS[Number(mm) - 1]}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>sin fecha</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ color: p.color, fontWeight: 600 }}>{p.label}</span>
                      {n != null && <span>{countdown(n)}</span>}
                    </div>
                  </div>
                  <DeleteButton id={g.id} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {perf.length > 0 && (
        <div style={{ marginTop: "22px" }}>
          <h3 className="group-title" style={{ marginBottom: "10px" }}>Metas de rendimiento</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {perf.map((g) => {
              const isFtp = /ftp/i.test(g.metric ?? "");
              const current = isFtp && currentFtp ? currentFtp : g.baselineValue;
              const from = g.baselineValue;
              const to = g.targetValue;
              let pct: number | null = null;
              if (from != null && to != null && current != null && to !== from) pct = Math.max(0, Math.min(100, Math.round(((current - from) / (to - from)) * 100)));
              const p = PRIORITY[g.priority];
              return (
                <div key={g.id} style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface-2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 600 }}>{g.name}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
                        <span style={{ color: p.color, fontWeight: 600 }}>{p.label}</span>
                        {g.eventDate ? ` · para el ${Number(g.eventDate.slice(8))} ${MONTHS[Number(g.eventDate.slice(5, 7)) - 1]} (${countdown(daysUntil(g.eventDate, todayKey))})` : ""}
                      </div>
                    </div>
                    <DeleteButton id={g.id} />
                  </div>
                  {(from != null || to != null) && (
                    <div style={{ marginTop: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "12px", marginBottom: "6px" }}>
                        <span style={{ color: "var(--text-muted)" }}>{from ?? "?"} {g.metric}</span>
                        <span>{to ?? "?"} {g.metric}</span>
                      </div>
                      {pct != null && (
                        <>
                          <div style={{ height: "8px", borderRadius: "4px", background: "var(--surface-3)", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: "var(--teal)", borderRadius: "4px" }} />
                          </div>
                          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "6px" }}>
                            Hoy: {current} {g.metric} · {pct}% del camino
                            {isFtp && currentFtp ? " (tu FTP actual)" : ""}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {open && (
        <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
          <ActionForm
            action={async (fd) => {
              await addAction(fd);
              setOpen(false);
            }}
            success="Objetivo agregado"
          >
            <h3 className="group-title" style={{ marginBottom: "12px" }}>Nuevo objetivo</h3>
            <div className="seg" role="radiogroup" aria-label="Tipo de objetivo" style={{ marginBottom: "16px" }}>
              <button type="button" role="radio" aria-checked={type === "EVENT"} onClick={() => setType("EVENT")}>Carrera o evento</button>
              <button type="button" role="radio" aria-checked={type === "PERFORMANCE"} onClick={() => setType("PERFORMANCE")}>Meta de rendimiento</button>
            </div>
            <input type="hidden" name="goalType" value={type} />

            <div className="field-grid">
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Nombre</label>
                <div className="control">
                  <input name="name" required placeholder={type === "EVENT" ? "Ej: Gran Fondo Cordillera" : "Ej: Subir el FTP"} />
                </div>
              </div>

              <div className="field">
                <label>{type === "EVENT" ? "Fecha del evento" : "Fecha límite (opcional)"}</label>
                <div className="control">
                  <input name="eventDate" type="date" required={type === "EVENT"} />
                </div>
              </div>

              {type === "PERFORMANCE" && (
                <>
                  <div className="field">
                    <label>Qué querés mejorar</label>
                    <div className="control">
                      <input name="metric" required placeholder="FTP, peso, VO2max…" />
                    </div>
                  </div>
                  <div className="field">
                    <label>Valor de partida</label>
                    <div className="control">
                      <input name="baselineValue" type="number" step="0.1" required placeholder="Ej: 280" />
                    </div>
                  </div>
                  <div className="field">
                    <label>Valor que querés lograr</label>
                    <div className="control">
                      <input name="targetValue" type="number" step="0.1" required placeholder="Ej: 300" />
                    </div>
                  </div>
                </>
              )}

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Prioridad</label>
                <div className="prio">
                  {(["A", "B", "C"] as const).map((k) => (
                    <label key={k}>
                      <input type="radio" name="priority" value={k} defaultChecked={k === "B"} />
                      <div style={{ fontSize: "13px", fontWeight: 600, color: PRIORITY[k].color }}>{PRIORITY[k].label}</div>
                      <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>{PRIORITY[k].desc}</div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
              <SubmitButton pendingText="Guardando…" style={{ background: "var(--teal)", color: "#08201C", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "14px", fontWeight: 600 }}>
                Guardar objetivo
              </SubmitButton>
              <button type="button" className="btn" onClick={() => setOpen(false)} style={{ background: "transparent", border: "1px solid var(--border-strong)", color: "var(--text-muted)", borderRadius: "10px", padding: "10px 16px", fontSize: "14px", cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
