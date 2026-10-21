"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveOnboardingStep, submitOnboarding, skipOnboarding, type OnboardingPayload } from "@/lib/onboarding-actions";

const DAY_NAMES: Record<number, string> = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 0: "Domingo" };
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const TYPES = [
  { value: "cycling", label: "Bici" },
  { value: "gym", label: "Gimnasio" },
  { value: "flexibility", label: "Movilidad" },
  { value: "rest", label: "Descanso" },
] as const;
const PRESET_MIN = [45, 60, 90, 120, 180, 240];
const PROFILES = [
  ["", "No sé / general"], ["llano", "Llano"], ["ondulado", "Ondulado"], ["montana", "Montaña"], ["fondo", "Gran fondo"], ["contrarreloj", "Contrarreloj"], ["criterium", "Criterium"],
] as const;

type Day = OnboardingPayload["days"][number];
const mk = (dayOfWeek: number, type: Day["type"], min: number, quality = false): Day => ({ dayOfWeek, type, quality, min: type === "rest" ? "" : String(min) });
/** Semanas de ejemplo para arrancar (el alumno las ajusta): días de calidad nunca seguidos y la salida larga el fin de semana. */
const PRESETS: { label: string; days: Day[] }[] = [
  { label: "3 días de bici", days: [mk(1, "rest", 0), mk(2, "cycling", 75, true), mk(3, "rest", 0), mk(4, "cycling", 60), mk(5, "rest", 0), mk(6, "cycling", 150), mk(0, "rest", 0)] },
  { label: "4 días de bici + gimnasio", days: [mk(1, "gym", 60), mk(2, "cycling", 90, true), mk(3, "rest", 0), mk(4, "cycling", 60), mk(5, "gym", 60), mk(6, "cycling", 180), mk(0, "cycling", 90)] },
  { label: "5 días de bici", days: [mk(1, "rest", 0), mk(2, "cycling", 90, true), mk(3, "cycling", 60), mk(4, "cycling", 90, true), mk(5, "cycling", 60), mk(6, "cycling", 180), mk(0, "cycling", 120)] },
];

const STEPS = ["Tu bici", "Tu semana", "Tu objetivo", "Tus límites", "Resumen"];

const box: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "20px", marginBottom: "14px" };
const input: React.CSSProperties = { width: "100%", background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px 14px", color: "var(--text)", fontSize: "15px", outline: "none" };
const label: React.CSSProperties = { display: "block", fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "6px" };
const pill = (on: boolean): React.CSSProperties => ({ padding: "8px 12px", borderRadius: "999px", fontSize: "13px", fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? "var(--teal)" : "var(--border)"}`, background: on ? "rgba(79,209,197,.14)" : "transparent", color: on ? "var(--teal)" : "var(--text-muted)" });

export function OnboardingWizard({ initial, coachName, hasCoach, name }: { initial: OnboardingPayload; coachName: string | null; hasCoach: boolean; name: string }) {
  const [step, setStep] = useState(1);
  const [p, setP] = useState<OnboardingPayload>(initial);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reviewer: string | null } | null>(null);
  const [pending, start] = useTransition();

  const set = (patch: Partial<OnboardingPayload>) => setP((prev) => ({ ...prev, ...patch }));
  const setDay = (d: number, patch: Partial<Day>) =>
    setP((prev) => ({
      ...prev,
      days: prev.days.map((x) => {
        if (x.dayOfWeek !== d) return x;
        const n = { ...x, ...patch };
        if (n.type !== "cycling") n.quality = false;
        if (n.type === "rest") n.min = "";
        else if (patch.type && n.min === "") n.min = patch.type === "cycling" ? "60" : patch.type === "gym" ? "60" : "20";
        return n;
      }),
    }));

  const cycling = p.days.filter((d) => d.type === "cycling");
  const quality = cycling.filter((d) => d.quality);
  const totalMin = cycling.reduce((s, d) => s + (Number(d.min) || 0), 0);
  const badMin = cycling.some((d) => !(Number(d.min) >= 15 && Number(d.min) <= 600));
  const adjacent = quality.some((a) => quality.some((b) => a !== b && Math.min(Math.abs(a.dayOfWeek - b.dayOfWeek), 7 - Math.abs(a.dayOfWeek - b.dayOfWeek)) < 2));
  const longest = cycling.reduce<Day | null>((m, d) => (!m || Number(d.min) > Number(m.min) ? d : m), null);
  const gymBeforeLong = longest && p.days.some((d) => d.type === "gym" && (d.dayOfWeek + 1) % 7 === longest.dayOfWeek);

  const next = () => {
    setError(null);
    if (step === 2 && badMin) return setError("Cada día de bici necesita entre 15 y 600 minutos");
    start(async () => {
      if (step <= 4) {
        const r = await saveOnboardingStep(step, p);
        if (r && "error" in r) return setError(r.error);
        setStep(step + 1);
      } else {
        const r = await submitOnboarding();
        if ("error" in r) return setError(r.error);
        setDone(r);
      }
    });
  };

  if (done) {
    return (
      <div className="page-container-narrow" style={{ textAlign: "center", paddingTop: "40px" }}>
        <div style={{ fontSize: "40px", marginBottom: "10px" }} aria-hidden>✓</div>
        <h1 style={{ fontSize: "22px", fontWeight: 600, margin: "0 0 8px" }}>Listo, {name || "ya está"}</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "14.5px", lineHeight: 1.55, maxWidth: "420px", margin: "0 auto 22px" }}>
          {hasCoach ? `${done.reviewer ?? "Tu coach"} va a revisar tu configuración y arma tu plan. Si hay algo para ajustar, lo corrige él mismo.` : "Tu configuración quedó guardada."} Mientras tanto, cargá tu check-in diario: ayuda a que el plan se ajuste a cómo estás.
        </p>
        <Link href="/dashboard" className="btn btn-primary">Ir al Inicio</Link>
      </div>
    );
  }

  return (
    <div className="page-container-narrow" style={{ paddingTop: "18px" }}>
      <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }} aria-hidden>
        {STEPS.map((_, i) => <div key={i} style={{ flex: 1, height: "4px", borderRadius: "2px", background: i < step ? "var(--teal)" : "var(--border)" }} />)}
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-dim)", marginBottom: "14px" }}>Paso {step} de 5 · {STEPS[step - 1]}</div>

      {step === 1 && (
        <div style={box}>
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 6px" }}>Hola{name ? `, ${name}` : ""}. Empecemos por tu bici</h1>
          <p style={{ fontSize: "13.5px", color: "var(--text-muted)", lineHeight: 1.55, margin: "0 0 16px" }}>Con tu FTP la app calcula la potencia de cada intervalo. Si no lo sabés, dejalo vacío y lo define tu coach.</p>
          <label style={label} htmlFor="ob-ftp">FTP (watts)</label>
          <input id="ob-ftp" style={{ ...input, marginBottom: "14px" }} inputMode="numeric" value={p.ftp} onChange={(e) => set({ ftp: e.target.value })} placeholder="Por ejemplo 230" />
          <label style={label} htmlFor="ob-w">Peso (kg)</label>
          <input id="ob-w" style={input} inputMode="decimal" value={p.weight} onChange={(e) => set({ weight: e.target.value })} placeholder="Por ejemplo 62" />
        </div>
      )}

      {step === 2 && (
        <div style={box}>
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 6px" }}>Tu semana tipo</h1>
          <p style={{ fontSize: "13.5px", color: "var(--text-muted)", lineHeight: 1.55, margin: "0 0 12px" }}>Contá qué día podés entrenar y cuánto tiempo tenés. El día más largo va a ser tu salida larga. Los días de <b>calidad</b> son los de intervalos fuertes: marcá 1 o 2 y no seguidos.</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-dim)", alignSelf: "center" }}>Arrancar con:</span>
            {PRESETS.map((pr) => <button key={pr.label} type="button" style={pill(false)} onClick={() => set({ days: pr.days.map((d) => ({ ...d })) })}>{pr.label}</button>)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {ORDER.map((dw) => {
              const d = p.days.find((x) => x.dayOfWeek === dw)!;
              return (
                <div key={dw} style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "10px 12px", background: d.type === "rest" ? "transparent" : "var(--surface-2, rgba(255,255,255,.03))" }}>
                  <div style={{ fontSize: "13.5px", fontWeight: 600, marginBottom: "8px" }}>{DAY_NAMES[dw]}</div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }} role="radiogroup" aria-label={`Qué hacés el ${DAY_NAMES[dw]}`}>
                    {TYPES.map((t) => <button key={t.value} type="button" role="radio" aria-checked={d.type === t.value} style={pill(d.type === t.value)} onClick={() => setDay(dw, { type: t.value })}>{t.label}</button>)}
                  </div>
                  {d.type !== "rest" && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", marginTop: "8px" }}>
                      {(d.type === "cycling" ? PRESET_MIN : [30, 45, 60, 90]).map((m) => <button key={m} type="button" style={pill(d.min === String(m))} onClick={() => setDay(dw, { min: String(m) })}>{m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}` : `${m} min`}</button>)}
                      <input aria-label={`Minutos ${DAY_NAMES[dw]}`} inputMode="numeric" value={d.min} onChange={(e) => setDay(dw, { min: e.target.value })} style={{ ...input, width: "78px", padding: "8px 10px", fontSize: "13px" }} />
                      <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>min</span>
                    </div>
                  )}
                  {d.type === "cycling" && (
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", marginTop: "8px", cursor: "pointer" }}>
                      <input type="checkbox" checked={d.quality} onChange={(e) => setDay(dw, { quality: e.target.checked })} style={{ width: "18px", height: "18px" }} />
                      Día de calidad (intervalos fuertes)
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "12px" }}>
            {cycling.length} día{cycling.length === 1 ? "" : "s"} de bici · {quality.length} de calidad · {Math.floor(totalMin / 60)} h {String(totalMin % 60).padStart(2, "0")} min por semana{longest ? ` · salida larga: ${DAY_NAMES[longest.dayOfWeek]}` : ""}
          </div>
          {adjacent && <div style={{ fontSize: "12.5px", color: "var(--amber)", marginTop: "6px" }}>Marcaste días de calidad seguidos: hacen falta 48 h entre sesiones fuertes, así que uno pasará a rodaje suave.</div>}
          {quality.length === 0 && cycling.length > 0 && <div style={{ fontSize: "12.5px", color: "var(--amber)", marginTop: "6px" }}>No marcaste ningún día de calidad: todas las salidas serían suaves.</div>}
          {gymBeforeLong && <div style={{ fontSize: "12.5px", color: "var(--amber)", marginTop: "6px" }}>Tenés gimnasio el día antes de tu salida larga: puede llegarte cansado. Tu coach lo va a revisar.</div>}
          {badMin && <div style={{ fontSize: "12.5px", color: "var(--red)", marginTop: "6px" }}>Cada día de bici necesita entre 15 y 600 minutos.</div>}
        </div>
      )}

      {step === 3 && (
        <div style={box}>
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 6px" }}>Tu objetivo</h1>
          <p style={{ fontSize: "13.5px", color: "var(--text-muted)", lineHeight: 1.55, margin: "0 0 14px" }}>El plan se arma hacia una fecha. Si todavía no tenés carrera, elegí mejorar en general; después podés sumarla en Ajustes.</p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
            <button type="button" style={pill(p.goal.mode === "event")} onClick={() => set({ goal: { ...p.goal, mode: "event" } })}>Tengo una carrera</button>
            <button type="button" style={pill(p.goal.mode === "general")} onClick={() => set({ goal: { ...p.goal, mode: "general" } })}>Mejorar en general</button>
          </div>
          {p.goal.mode === "event" && (
            <>
              <label style={label} htmlFor="ob-gn">Nombre de la carrera</label>
              <input id="ob-gn" style={{ ...input, marginBottom: "12px" }} value={p.goal.name} onChange={(e) => set({ goal: { ...p.goal, name: e.target.value } })} placeholder="Por ejemplo Gran Fondo" />
              <label style={label} htmlFor="ob-gd">Fecha</label>
              <input id="ob-gd" type="date" style={{ ...input, marginBottom: "12px" }} value={p.goal.date} onChange={(e) => set({ goal: { ...p.goal, date: e.target.value } })} />
              <div style={label}>Importancia</div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                {([["A", "A · la más importante"], ["B", "B · importante"], ["C", "C · para probarme"]] as const).map(([k, t]) => <button key={k} type="button" style={pill(p.goal.priority === k)} onClick={() => set({ goal: { ...p.goal, priority: k } })}>{t}</button>)}
              </div>
              <label style={label} htmlFor="ob-gp">Tipo de recorrido</label>
              <select id="ob-gp" style={input} value={p.goal.profile} onChange={(e) => set({ goal: { ...p.goal, profile: e.target.value } })}>
                {PROFILES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </>
          )}
        </div>
      )}

      {step === 4 && (
        <div style={box}>
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 6px" }}>Tus límites</h1>
          <p style={{ fontSize: "13.5px", color: "var(--text-muted)", lineHeight: 1.55, margin: "0 0 14px" }}>Todo es opcional, pero ayuda a que el plan no te proponga algo que no podés o no querés hacer.</p>
          {([
            ["injuries", "Lesiones o molestias actuales", "Por ejemplo: dolor de rodilla derecha al subir"],
            ["preferences", "Cosas que no querés o no podés hacer", "Por ejemplo: sin rodillo los fines de semana, no me gustan los sprints"],
            ["background", "Tu experiencia", "Por ejemplo: 3 años en ruta, vengo de running"],
          ] as const).map(([k, t, ph]) => (
            <div key={k} style={{ marginBottom: "12px" }}>
              <label style={label} htmlFor={`ob-${k}`}>{t}</label>
              <textarea id={`ob-${k}`} rows={3} style={{ ...input, resize: "vertical" }} value={p[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<OnboardingPayload>)} placeholder={ph} maxLength={2000} />
            </div>
          ))}
        </div>
      )}

      {step === 5 && (
        <div style={box}>
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 12px" }}>Revisá y enviá</h1>
          {[
            ["Bici", `${p.ftp ? `FTP ${p.ftp} W` : "FTP sin definir (lo define tu coach)"}${p.weight ? ` · ${p.weight} kg` : ""}`],
            ["Semana", `${cycling.length} días de bici · ${quality.length} de calidad · ${Math.floor(totalMin / 60)} h ${String(totalMin % 60).padStart(2, "0")} min${longest ? ` · larga el ${DAY_NAMES[longest.dayOfWeek].toLowerCase()}` : ""}`],
            ["Objetivo", p.goal.mode === "event" ? `${p.goal.name || "—"} · ${p.goal.date || "sin fecha"} · prioridad ${p.goal.priority}` : "Mejorar en general"],
            ["Límites", [p.injuries, p.preferences].filter(Boolean).join(" · ") || "Sin límites cargados"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: "12px", padding: "9px 0", borderTop: "1px solid var(--border)", fontSize: "13.5px" }}>
              <div style={{ width: "74px", color: "var(--text-dim)", flexShrink: 0 }}>{k}</div>
              <div>{v}</div>
            </div>
          ))}
          <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.55, margin: "14px 0 0" }}>
            {hasCoach ? `${coachName ?? "Tu coach"} va a revisar esto antes de armar tu plan y puede corregirlo.` : "Podés cambiar todo esto después en Ajustes."}
          </p>
        </div>
      )}

      {error && <div role="alert" style={{ color: "var(--red)", fontSize: "13px", marginBottom: "10px" }}>{error}</div>}

      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        {step > 1 && <button type="button" className="btn btn-outline" disabled={pending} onClick={() => { setError(null); setStep(step - 1); }}>Atrás</button>}
        <button type="button" className="btn btn-primary" disabled={pending} onClick={next}>
          {pending ? "Guardando…" : step === 5 ? (hasCoach ? "Enviar a mi coach" : "Terminar") : "Siguiente"}
        </button>
        <button type="button" className="btn btn-outline" disabled={pending} style={{ marginLeft: "auto", fontSize: "12.5px", color: "var(--text-dim)" }} onClick={() => start(async () => { await skipOnboarding(); window.location.href = "/dashboard"; })}>
          Lo hago después
        </button>
      </div>
    </div>
  );
}
