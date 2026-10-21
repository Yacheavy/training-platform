"use client";

import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";
import { COURSE_PROFILES, courseProfileLabel } from "@/lib/training-engine/race-week";

export interface GoalRow {
  id: string;
  goalType: "EVENT" | "PERFORMANCE";
  name: string;
  eventDate: string | null; // YYYY-MM-DD
  priority: "A" | "B" | "C";
  metric: string | null;
  baselineValue: number | null;
  targetValue: number | null;
  /** Lo cargó el entrenador */
  createdByCoach?: boolean;
  /** Perfil de la prueba (adapta la activación y el calentamiento) */
  courseProfile?: string | null;
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

/** Qué mide una meta de rendimiento y en qué unidad (las metas viejas guardan solo «FTP»; las del asistente, «W de FTP», «W en 5 min», «kg de peso») */
function metricInfo(metric: string | null): { label: string; unit: string; kind: "ftp" | "p5" | "weight" | "other" } {
  const m = metric ?? "";
  if (/ftp/i.test(m)) return { label: "FTP", unit: "W", kind: "ftp" };
  if (/5\s?min/i.test(m)) return { label: "Potencia de 5 min", unit: "W", kind: "p5" };
  if (/peso|kg/i.test(m)) return { label: "Peso", unit: "kg", kind: "weight" };
  return { label: m || "Meta", unit: "", kind: "other" };
}
const num = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");

/** Barra de avance: del punto de partida (al fijar la meta) a la meta, con un marcador en el valor de hoy */
function GoalProgress({ label, own, unit, from, to, current, source }: { label: string; own: string; unit: string; from: number; to: number; current: number | null; source?: string }) {
  const u = unit ? ` ${unit}` : "";
  const span = to - from;
  const raw = current != null && span !== 0 ? (current - from) / span : null; // <0: fue para el otro lado; >1: superó la meta
  const pct = raw == null ? null : Math.max(0, Math.min(1, raw));
  const done = raw != null && raw >= 1;
  const remaining = current != null ? Math.abs(to - current) : Math.abs(span);
  let status: { text: string; color: string };
  if (current == null) status = { text: "Sin dato actual para medir el avance.", color: "var(--text-muted)" };
  else if (done) status = { text: "¡Meta alcanzada!", color: "var(--teal)" };
  else if (raw! < 0) status = { text: `Estás ${num(Math.abs(current - from))}${u} ${span > 0 ? "por debajo" : "por encima"} del punto de partida.`, color: "var(--amber)" };
  else if (raw === 0) status = { text: `Todavía sin avance: ${own} sigue igual que al fijar la meta.`, color: "var(--text-muted)" };
  else status = { text: `Te ${remaining === 1 ? "falta" : "faltan"} ${num(remaining)}${u} para llegar.`, color: "var(--text-muted)" };
  return (
    <div style={{ marginTop: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: "10.5px", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-dim)" }}>Punto de partida</div>
          <div style={{ fontSize: "15px", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{num(from)}{u}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "10.5px", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-dim)" }}>Meta</div>
          <div style={{ fontSize: "15px", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--teal)" }}>{num(to)}{u}</div>
        </div>
      </div>
      <div style={{ position: "relative", height: "10px", margin: "10px 0 6px", borderRadius: "5px", background: "var(--surface-3)" }} role="progressbar" aria-label={`Avance hacia la meta de ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct == null ? undefined : Math.round(pct * 100)}>
        {pct != null && <div style={{ width: `${pct * 100}%`, height: "100%", borderRadius: "5px", background: "linear-gradient(90deg, var(--teal-dim), var(--teal))", transition: "width .4s ease" }} />}
        {pct != null && <span aria-hidden style={{ position: "absolute", top: "50%", left: `${pct * 100}%`, width: "16px", height: "16px", transform: "translate(-50%, -50%)", borderRadius: "50%", background: "var(--bg)", border: `3px solid ${done ? "var(--teal)" : "var(--text)"}` }} />}
      </div>
      {current != null && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "12.5px" }}>
          <b style={{ color: "var(--text)" }}>Hoy: {num(current)}{u}</b>
          {pct != null && <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{Math.round(pct * 100)}% del camino</span>}
        </div>
      )}
      <div style={{ fontSize: "12px", color: status.color, marginTop: "6px", lineHeight: 1.45 }}>{status.text}</div>
      {current != null && source && <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>«Hoy» sale {source}.</div>}
    </div>
  );
}

export function GoalsCard({
  goals,
  todayKey,
  currentFtp,
  currentP5 = null,
  currentWeight = null,
  addAction,
  deleteAction,
  updateProfileAction,
  cardStyle,
  coachMode = false,
}: {
  goals: GoalRow[];
  todayKey: string;
  currentFtp: number | null;
  /** Potencia de 5 min y peso actuales (para medir el avance de esas metas) */
  currentP5?: number | null;
  currentWeight?: number | null;
  addAction: (formData: FormData) => Promise<unknown>;
  deleteAction: (formData: FormData) => Promise<unknown>;
  updateProfileAction: (formData: FormData) => Promise<unknown>;
  cardStyle: React.CSSProperties;
  /** Lo ve el entrenador en la cuenta de un alumno (cambia el texto de la etiqueta). */
  coachMode?: boolean;
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
          <h2 className="card-title">Objetivos</h2>
          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: 0 }}>
            Carreras y metas que orientan tu plan. La prioridad indica cuánto se organiza el entrenamiento alrededor de cada una. En las A y B el plan arma la semana previa: una activación la víspera y un calentamiento el día de la carrera.
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
                    <div style={{ fontSize: "14px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}{g.createdByCoach && <span style={{ fontSize: "10.5px", color: "var(--teal)", border: "1px solid var(--teal-dim)", borderRadius: "999px", padding: "1px 8px", marginLeft: "8px", fontWeight: 500 }}>{coachMode ? "Cargado por vos" : "Cargado por tu coach"}</span>}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ color: p.color, fontWeight: 600 }}>{p.label}</span>
                      {n != null && <span>{countdown(n)}</span>}
                      {g.priority !== "C" && <span>· {courseProfileLabel(g.courseProfile) ?? "Perfil sin definir"}</span>}
                    </div>
                    {g.priority !== "C" && (n == null || n >= 0) && (
                      <details style={{ marginTop: "8px" }}>
                        <summary style={{ fontSize: "11.5px", color: "var(--teal)", cursor: "pointer" }}>Perfil de la prueba</summary>
                        <ActionForm action={updateProfileAction} success="Perfil guardado. Regenerá el plan para aplicarlo">
                          <input type="hidden" name="id" value={g.id} />
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginTop: "8px" }}>
                            <select name="courseProfile" defaultValue={g.courseProfile ?? ""} aria-label="Perfil de la prueba" style={{ background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border-strong)", borderRadius: "8px", padding: "6px 8px", fontSize: "12px", maxWidth: "100%" }}>
                              <option value="">Sin definir (genérico)</option>
                              {COURSE_PROFILES.map((c) => (
                                <option key={c.key} value={c.key}>{c.label}</option>
                              ))}
                            </select>
                            <SubmitButton pendingText="Guardando…" style={{ background: "transparent", color: "var(--teal)", border: "1px solid var(--teal-dim)", borderRadius: "8px", padding: "5px 10px", fontSize: "12px" }}>
                              Guardar
                            </SubmitButton>
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "6px", lineHeight: 1.5 }}>Cambia la forma de la activación de la víspera y del calentamiento. Para que se aplique, regenerá el plan.</div>
                        </ActionForm>
                      </details>
                    )}
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
              const mi = metricInfo(g.metric);
              const live = mi.kind === "ftp" ? currentFtp : mi.kind === "p5" ? currentP5 : mi.kind === "weight" ? currentWeight : null;
              const from = g.baselineValue;
              const to = g.targetValue;
              const p = PRIORITY[g.priority];
              return (
                <div key={g.id} style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface-2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 600 }}>{g.name}{g.createdByCoach && <span style={{ fontSize: "10.5px", color: "var(--teal)", border: "1px solid var(--teal-dim)", borderRadius: "999px", padding: "1px 8px", marginLeft: "8px", fontWeight: 500 }}>{coachMode ? "Cargado por vos" : "Cargado por tu coach"}</span>}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
                        <span style={{ color: p.color, fontWeight: 600 }}>{p.label}</span>
                        {g.eventDate ? ` · para el ${Number(g.eventDate.slice(8))} ${MONTHS[Number(g.eventDate.slice(5, 7)) - 1]} (${countdown(daysUntil(g.eventDate, todayKey))})` : ""}
                      </div>
                    </div>
                    <DeleteButton id={g.id} />
                  </div>
                  {from != null && to != null ? (
                    <GoalProgress label={mi.label} own={mi.kind === "ftp" ? "tu FTP" : mi.kind === "p5" ? "tu potencia de 5 min" : mi.kind === "weight" ? "tu peso" : "tu valor"} unit={mi.unit} from={from} to={to} current={live} source={mi.kind === "ftp" ? "del FTP que tenés cargado en Ajustes" : mi.kind === "p5" ? "de la potencia de 5 min que tenés cargada en Ajustes" : mi.kind === "weight" ? "del peso que tenés cargado en tu perfil" : undefined} />
                  ) : from != null || to != null ? (
                    <div style={{ marginTop: "10px", fontSize: "12.5px", color: "var(--text-muted)" }}>{from != null ? `Desde ${num(from)}` : `Meta ${num(to as number)}`} {mi.unit}</div>
                  ) : null}
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

              {type === "EVENT" && (
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Perfil de la prueba (opcional)</label>
                  <div className="control">
                    <select name="courseProfile" defaultValue="">
                      <option value="">Sin definir (genérico)</option>
                      {COURSE_PROFILES.map((c) => (
                        <option key={c.key} value={c.key}>{c.label} — {c.desc}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-dim)", marginTop: "6px", lineHeight: 1.5 }}>
                    En las carreras A y B adapta la activación de la víspera y el calentamiento del día a cómo arranca la prueba.
                  </div>
                </div>
              )}

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
