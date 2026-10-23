import type { ReactNode } from "react";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";
import { decideReadinessAdjustment } from "@/lib/readiness-actions";

export type ReadinessSignalKey = "hrv" | "resting_hr" | "tsb" | "checkin";
export interface ReadinessSignal { key: ReadinessSignalKey; title: string; detail: string }

const fmt1 = (n: number) => n.toFixed(1).replace(".", ",").replace("-", "−");
const fmt0 = (n: number) => String(Math.round(n));
const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

/** "Umbral X · te pasaste por Y" + aviso si está apenas pasado (la alerta es binaria: conviene ver cuánto falta para que desaparezca). */
function marginText(value: number, base: number | null, threshold: number | null, unit: string, below: boolean): string | null {
  if (threshold == null) return null;
  const over = below ? threshold - value : value - threshold; // cuánto se pasó del umbral (>0 = en alerta)
  const dist = base != null ? Math.abs(base - threshold) : null; // distancia base → umbral
  const near = dist != null && dist > 0 && over / dist < 0.5;
  return `Alerta desde ${threshold.toFixed(1).replace(".", ",")} ${unit} · estás ${Math.abs(over).toFixed(1).replace(".", ",")} ${unit} ${below ? "por debajo" : "por encima"}${near ? " · cerca del límite" : ""}`;
}

interface AvailabilityLike {
  signalsTriggered: string[];
  chips: { key: string; state: string }[];
  alertReasons: string[];
  hrvAvg7d: number | null;
  hrvDeltaPct: number | null;
  hrvBaseline: number | null;
  restingHrAvg7d: number | null;
  restingHrDeltaAbs: number | null;
  restingHrBaseline: number | null;
  hrvThreshold: number | null;
  restingHrThreshold: number | null;
  minTsb: number;
  tsb: number | null;
  sources: string[];
}

/** Arma las filas de "qué señales están en alerta" con el dato clave en el título y el contexto debajo (coma decimal, como el resto de la app). */
export function buildReadinessSignals(a: AvailabilityLike): ReadinessSignal[] {
  const out: ReadinessSignal[] = [];
  if (a.signalsTriggered.includes("hrv") && a.hrvAvg7d != null && a.hrvDeltaPct != null) {
    out.push({
      key: "hrv",
      title: `HRV ${fmt0(a.hrvAvg7d)} ms · ${fmt1(Math.abs(a.hrvDeltaPct))} % ${a.hrvDeltaPct < 0 ? "bajo" : "sobre"} tu base`,
      detail: [a.hrvBaseline != null ? `Media de 7 días contra tu línea base (${fmt0(a.hrvBaseline)} ms)` : "Media de 7 días contra tu línea base", marginText(a.hrvAvg7d, a.hrvBaseline, a.hrvThreshold, "ms", true)].filter(Boolean).join(" · "),
    });
  }
  if (a.signalsTriggered.includes("resting_hr") && a.restingHrAvg7d != null && a.restingHrDeltaAbs != null) {
    out.push({
      key: "resting_hr",
      title: `FC de reposo ${fmt1(a.restingHrAvg7d)} lpm · ${sign(a.restingHrDeltaAbs)}${fmt1(Math.abs(a.restingHrDeltaAbs))} ${a.restingHrDeltaAbs > 0 ? "sobre" : "bajo"} tu base`,
      detail: [a.restingHrBaseline != null ? `Media de 7 días contra tu línea base (${fmt1(a.restingHrBaseline)} lpm)` : "Media de 7 días contra tu línea base", marginText(a.restingHrAvg7d, a.restingHrBaseline, a.restingHrThreshold, "lpm", false)].filter(Boolean).join(" · "),
    });
  }
  if (a.chips.find((c) => c.key === "tsb")?.state === "alert" && a.tsb != null) {
    out.push({
      key: "tsb",
      title: `Forma ${fmt1(a.tsb)} · cansancio acumulado alto`,
      detail: `Al empezar el día, por debajo de tu mínimo (${a.minTsb})`,
    });
  }
  if (a.signalsTriggered.some((s) => ["fatigue", "stress", "muscle_soreness", "sleep_quality"].includes(s))) {
    const names: Record<string, string> = { fatigue: "fatiga", stress: "estrés", muscle_soreness: "dolor muscular", sleep_quality: "sueño" };
    const hits = a.signalsTriggered.filter((s) => names[s]).map((s) => names[s]);
    out.push({ key: "checkin", title: `Check-in: ${hits.join(", ")} fuera de lo normal`, detail: "Lo que reportaste esta mañana" });
  }
  return out;
}

const ICON_PATHS: Record<ReadinessSignalKey, ReactNode> = {
  // Onda de variabilidad (barras de distinta altura)
  hrv: <path d="M3 12h2M8 8v8M12 4v16M16 8v8M21 12h-2" />,
  // Corazón de línea con pulso
  resting_hr: (
    <>
      <path d="M19.5 13.6 12 21l-7.5-7.4A5 5 0 0 1 12 6.6a5 5 0 0 1 7.5 7Z" />
      <path d="M3.5 12.2h4.3l1.7-3 2.6 5.4 1.8-3.2h6.6" />
    </>
  ),
  // Batería baja
  tsb: (
    <>
      <rect x="2.5" y="7.5" width="16" height="9" rx="2.2" />
      <path d="M21.5 11v2M6 11v2" />
    </>
  ),
  // Planilla con tilde
  checkin: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2.2" />
      <path d="M9 3h6v3H9zM9 13.2l2 2 4-4" />
    </>
  ),
};

function SignalIcon({ k, tone }: { k: ReadinessSignalKey; tone: string }) {
  return (
    <span style={{ width: "34px", height: "34px", borderRadius: "10px", display: "grid", placeItems: "center", flex: "none", background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {ICON_PATHS[k]}
      </svg>
    </span>
  );
}

const btnBase = { borderRadius: "12px", padding: "12px 18px", fontSize: "14.5px", fontWeight: 700, cursor: "pointer" } as const;

/**
 * Guía principal del día cuando el semáforo no está en verde: qué señales están en alerta, qué cambiaría en la sesión de hoy y qué
 * pasa si se mantiene. Solo presentación: el semáforo y la propuesta salen de la misma lógica de siempre.
 */
export interface ReadinessChange { workoutId: string; current: string; proposal: string; hint: string | null; inIntervals: boolean }

export function ReadinessCard({
  status, nAlerts, nSources, signals, change, noChangeText, title,
}: {
  status: "RED" | "AMBER";
  nAlerts: number;
  nSources: number;
  signals: ReadinessSignal[];
  /** Cambio propuesto sobre la sesión de hoy; null si no hay un ajuste automático que proponer. */
  change: ReadinessChange | null;
  /** Qué decir cuando no hay cambio propuesto (sin sesión hoy, ya hecha, o una sesión sin ajuste automático). */
  noChangeText: string;
  /** Reemplaza el título estándar (ej. cuando hoy ya se entrenó). */
  title?: string;
}) {
  const tone = status === "RED" ? "var(--red)" : "var(--amber)";
  return (
    <section
      aria-label="Guía para hoy"
      style={{ marginBottom: "16px", border: `1.5px solid ${tone}`, borderRadius: "var(--r-lg)", padding: "18px", background: `linear-gradient(160deg, color-mix(in srgb, ${tone} 12%, #171E27) 0%, #171E27 60%)` }}
    >
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: tone, boxShadow: `0 0 0 5px color-mix(in srgb, ${tone} 20%, transparent)`, flex: "none" }} />
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", lineHeight: 1.25 }}>{title ?? (status === "RED" ? "Hoy conviene bajar la intensidad" : "Hoy conviene ir con cuidado")}</h3>
          <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "2px" }}>
            {nAlerts} {nAlerts === 1 ? "señal en alerta" : "señales en alerta"} · calculado con {nSources} de 3
          </div>
        </div>
      </div>

      {signals.length > 0 && (
        <div style={{ display: "grid", gap: "8px", marginTop: "14px" }}>
          {signals.map((s) => (
            <div key={s.key} style={{ display: "flex", gap: "12px", alignItems: "center", padding: "10px 12px", borderRadius: "12px", background: "rgba(255,255,255,.035)" }}>
              <SignalIcon k={s.key} tone={tone} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 700 }}>{s.title}</div>
                <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "2px" }}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {change ? (
        <>
          <div style={{ marginTop: "14px", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden", fontSize: "13.5px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "10px 12px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>Hoy tenías</span>
              <span style={{ textAlign: "right" }}>{change.current}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "10px 12px", borderTop: "1px solid var(--border)", background: "color-mix(in srgb, var(--teal) 7%, transparent)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>Te propongo</span>
              <span style={{ textAlign: "right" }}><span style={{ color: "var(--teal)" }}>→</span> {change.proposal}{change.hint ? <span style={{ color: "var(--text-muted)" }}> · {change.hint}</span> : null}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
            <ActionForm action={decideReadinessAdjustment} success="Sesión ajustada" style={{ display: "contents" }}>
              <input type="hidden" name="workoutId" value={change.workoutId} />
              <input type="hidden" name="decision" value="apply" />
              <SubmitButton pendingText="Aplicando…" style={{ ...btnBase, flex: 1, background: "var(--teal)", color: "#0A1310", border: "none" }}>Aplicar el cambio</SubmitButton>
            </ActionForm>
            <ActionForm action={decideReadinessAdjustment} success="Se mantiene la sesión" style={{ display: "contents" }}>
              <input type="hidden" name="workoutId" value={change.workoutId} />
              <input type="hidden" name="decision" value="keep" />
              <SubmitButton pendingText="Guardando…" style={{ ...btnBase, background: "transparent", color: "var(--text)", border: "1px solid var(--border-strong)", fontWeight: 600 }}>Mantener la sesión</SubmitButton>
            </ActionForm>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "10px", lineHeight: 1.45 }}>
            Si la mantenés, decidís vos: escuchá las piernas y cortá lo intenso si no responde.{change.inIntervals ? " Si aplicás el cambio, también se actualiza en Intervals." : ""}
          </div>
        </>
      ) : (
        <div style={{ marginTop: "14px", fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>{noChangeText}</div>
      )}
    </section>
  );
}

/** Resumen compacto una vez que ya se decidió (reemplaza a la tarjeta grande). */
export function ReadinessDecided({ decision, detail }: { decision: "aplicada" | "mantenida"; detail: string }) {
  return (
    <div style={{ marginBottom: "16px", border: "1.5px solid var(--border)", borderRadius: "var(--r-lg)", background: "var(--surface)", padding: "14px 16px", display: "flex", gap: "12px", alignItems: "center" }}>
      <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "color-mix(in srgb, var(--teal) 16%, transparent)", color: "var(--teal)", display: "grid", placeItems: "center", flex: "none" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
      </span>
      <div>
        <div style={{ fontSize: "14px", fontWeight: 700 }}>{decision === "aplicada" ? "Ajuste aplicado a tu sesión" : "Mantuviste la sesión"}</div>
        <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "2px" }}>{detail}</div>
      </div>
    </div>
  );
}
