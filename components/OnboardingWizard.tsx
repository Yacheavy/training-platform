"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { WeekEditor, Segmented, Icon, buzz, pill, patchDay, weekStats, WeekBars, DAY_NAMES, type Day } from "./WeekEditor";
import { saveOnboardingStep, submitOnboarding, skipOnboarding, type OnboardingPayload } from "@/lib/onboarding-actions";

const PROFILES = [
  ["", "No sé / general"], ["llano", "Llano"], ["ondulado", "Ondulado"], ["montana", "Montaña"], ["fondo", "Gran fondo"], ["contrarreloj", "Contrarreloj"], ["criterium", "Criterium"],
] as const;

const mk = (dayOfWeek: number, type: Day["type"], min: number, quality = false): Day => ({ dayOfWeek, type, quality, min: type === "rest" ? "" : String(min) });
/** Semanas de ejemplo para arrancar (el alumno las ajusta): días de calidad nunca seguidos y la salida larga el fin de semana. */
const PRESETS: { label: string; days: Day[] }[] = [
  { label: "3 días de bici", days: [mk(1, "rest", 0), mk(2, "cycling", 75, true), mk(3, "rest", 0), mk(4, "cycling", 60), mk(5, "rest", 0), mk(6, "cycling", 150), mk(0, "rest", 0)] },
  { label: "4 días de bici + gimnasio", days: [mk(1, "gym", 60), mk(2, "cycling", 90, true), mk(3, "rest", 0), mk(4, "cycling", 60), mk(5, "gym", 60), mk(6, "cycling", 180), mk(0, "cycling", 90)] },
  { label: "5 días de bici", days: [mk(1, "rest", 0), mk(2, "cycling", 90, true), mk(3, "cycling", 60), mk(4, "cycling", 90, true), mk(5, "cycling", 60), mk(6, "cycling", 180), mk(0, "cycling", 120)] },
];

const STEPS = ["Tu bici", "Tu semana", "Tu objetivo", "Tus límites", "Resumen"];

/** Valores leídos de Intervals (FTP de la configuración de ciclismo y mejor esfuerzo de 5 min de los últimos 90 días) */
export type IntervalsValues = { ftp: number | null; p5: number | null } | null;

const box: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "18px", padding: "20px", marginBottom: "14px" };
const input: React.CSSProperties = { width: "100%", background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px 14px", color: "var(--text)", fontSize: "15px", outline: "none" };
const label: React.CSSProperties = { display: "block", fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "6px" };
const h1: React.CSSProperties = { fontSize: "21px", fontWeight: 650, letterSpacing: "-0.01em", margin: "0 0 6px" };
const lead: React.CSSProperties = { fontSize: "13.5px", color: "var(--text-muted)", lineHeight: 1.55, margin: "0 0 16px" };

function SourceNote({ value, remote, unit, what, onUse }: { value: string; remote: number | null; unit: string; what: string; onUse: () => void }) {
  if (remote == null) return null;
  const same = value.trim() === String(remote);
  return same ? (
    <div style={{ fontSize: "12px", color: "var(--teal)" }}>✓ Viene de tu Intervals ({what}). Podés cambiarlo.</div>
  ) : (
    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
      Tu Intervals tiene {remote} {unit} ({what}). <button type="button" onClick={onUse} style={{ background: "none", border: "none", padding: 0, color: "var(--teal)", textDecoration: "underline", cursor: "pointer", fontSize: "12px" }}>Usar ese valor</button>
    </div>
  );
}

const wkgLevel = (v: number) => (v < 2 ? "En construcción" : v < 3 ? "Recreativo" : v < 4 ? "Entrenado" : "Avanzado");

export function OnboardingWizard({ initial, coachName, hasCoach, name, intervals = null }: { initial: OnboardingPayload; coachName: string | null; hasCoach: boolean; name: string; intervals?: IntervalsValues }) {
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<1 | -1>(1);
    const [p, setP] = useState<OnboardingPayload>(initial);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reviewer: string | null } | null>(null);
  const [pending, start] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);

  // Al cambiar de paso vuelve arriba (la barra de acciones queda fija abajo)
  useEffect(() => { topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [step]);

  const set = (patch: Partial<OnboardingPayload>) => setP((prev) => ({ ...prev, ...patch }));
  const setDay = (d: number, patch: Partial<Day>) => setP((prev) => ({ ...prev, days: prev.days.map((x) => (x.dayOfWeek === d ? patchDay(x, patch) : x)) }));

  const { cycling, quality, totalMin, badMin, longest } = weekStats(p.days);
  const ftpN = Number(p.ftp), wN = Number(String(p.weight).replace(",", "."));
  const wkg = ftpN > 0 && wN > 0 ? ftpN / wN : null;

  const go = (to: number) => { setDir(to > step ? 1 : -1); setError(null); setStep(to); };
  const next = () => {
    setError(null);
    if (step === 2 && badMin) return setError("Cada día de bici necesita entre 15 y 600 minutos");
    start(async () => {
      if (step <= 4) {
        const r = await saveOnboardingStep(step, p);
        if (r && "error" in r) return setError(r.error);
        buzz();
        go(step + 1);
      } else {
        const r = await submitOnboarding();
        if ("error" in r) return setError(r.error);
        buzz();
        setDone(r);
      }
    });
  };
  const skip = () => start(async () => { await skipOnboarding(); window.location.href = "/dashboard"; });

  if (done) {
    const steps = hasCoach
      ? [["Enviado", "Tu configuración llegó a " + (done.reviewer ?? "tu coach"), true], ["Revisión", `${done.reviewer ?? "Tu coach"} la mira y la corrige si hace falta`, false], ["Tu plan", "Aparece en el calendario y se manda a Intervals", false]]
      : [["Guardado", "Tu configuración quedó guardada", true]];
    return (
      <div className="page-container-narrow wz-fade" style={{ textAlign: "center", paddingTop: "40px" }}>
        <svg className="wz-check" width="76" height="76" viewBox="0 0 76 76" aria-hidden>
          <circle cx="38" cy="38" r="35" fill="none" stroke="var(--teal)" strokeWidth="3" opacity=".25" />
          <circle className="wz-check-ring" cx="38" cy="38" r="35" fill="none" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" />
          <path className="wz-check-tick" d="M24 39l10 10 19-21" fill="none" stroke="var(--teal)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h1 style={{ ...h1, fontSize: "24px", marginTop: "16px" }}>Listo, {name || "ya está"}</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "14.5px", lineHeight: 1.55, maxWidth: "420px", margin: "0 auto 22px" }}>
          Mientras tanto, cargá tu check-in diario: ayuda a que el plan se ajuste a cómo estás.
        </p>
        <ol className="wz-timeline">
          {steps.map(([t, d, ok]) => (
            <li key={String(t)} data-done={!!ok}>
              <span className="wz-dot" aria-hidden>{ok ? "✓" : ""}</span>
              <div><div style={{ fontWeight: 600, fontSize: "14px" }}>{t}</div><div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "2px" }}>{d}</div></div>
            </li>
          ))}
        </ol>
        <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: "26px" }}>Ir al Inicio</Link>
      </div>
    );
  }

  return (
    <div className="page-container-narrow" style={{ paddingTop: "14px" }}>
      <div ref={topRef} style={{ scrollMarginTop: "12px" }} />
      <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }} aria-hidden>
        {STEPS.map((_, i) => <div key={i} className="wz-prog" data-on={i < step} data-cur={i === step - 1} />)}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>Paso {step} de 5 · {STEPS[step - 1]}</div>
        <button type="button" disabled={pending} onClick={skip} style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: "12px", textDecoration: "underline", textUnderlineOffset: "3px", cursor: "pointer", padding: "4px 0" }}>Lo hago después</button>
      </div>

      <div key={step} className={dir === 1 ? "wz-in-right" : "wz-in-left"}>
        {step === 1 && (
          <div style={box}>
            <h1 style={h1}>Hola{name ? `, ${name}` : ""}. Empecemos por tu bici</h1>
            {intervals && (intervals.ftp || intervals.p5) && <div className="wz-badge"><span aria-hidden />Sincronizado con Intervals</div>}
            <p style={lead}>
              {intervals && (intervals.ftp || intervals.p5) ? "Traje estos datos de tu Intervals. Revisalos: si no son los que querés usar, los podés cambiar a mano." : "Con tu FTP la app calcula la potencia de cada intervalo. Si no lo sabés, dejalo vacío y lo define tu coach."}
            </p>
            <label style={label} htmlFor="ob-ftp">FTP (watts)</label>
            <input id="ob-ftp" className="wz-num" style={{ ...input, marginBottom: "6px" }} inputMode="numeric" value={p.ftp} onChange={(e) => set({ ftp: e.target.value })} placeholder="Por ejemplo 230" />
            <SourceNote value={p.ftp} remote={intervals?.ftp ?? null} unit="W" what="FTP" onUse={() => set({ ftp: String(intervals?.ftp) })} />
            <label style={{ ...label, marginTop: "14px" }} htmlFor="ob-p5">Potencia de 5 minutos (watts)</label>
            <input id="ob-p5" className="wz-num" style={{ ...input, marginBottom: "6px" }} inputMode="numeric" value={p.p5} onChange={(e) => set({ p5: e.target.value })} placeholder="Tu mejor esfuerzo de 5 min" />
            <SourceNote value={p.p5} remote={intervals?.p5 ?? null} unit="W" what="mejor esfuerzo de 5 min de los últimos 90 días" onUse={() => set({ p5: String(intervals?.p5) })} />
            <div style={{ fontSize: "12px", color: "var(--text-dim)", margin: "4px 0 14px", lineHeight: 1.45 }}>Se usa para calcular la potencia de los intervalos de VO2max. Si nunca hiciste un esfuerzo máximo de 5 min, dejalo vacío.</div>
            <label style={label} htmlFor="ob-w">Peso (kg)</label>
            <input id="ob-w" className="wz-num" style={input} inputMode="decimal" value={p.weight} onChange={(e) => set({ weight: e.target.value })} placeholder="Por ejemplo 62" />
            {wkg && wkg >= 0.8 && wkg <= 7 && (
              <div className="wz-stat" aria-live="polite">
                <div><div className="wz-stat-n">{wkg.toFixed(2).replace(".", ",")}</div><div className="wz-stat-u">W/kg</div></div>
                <div style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.45 }}><b style={{ color: "var(--text)" }}>{wkgLevel(wkg)}</b><br />Referencia aproximada de tu FTP por kilo; cambia con el sexo y la edad.</div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div style={box}>
            <h1 style={h1}>Tu semana tipo</h1>
            <p style={{ ...lead, margin: "0 0 12px" }}>Tocá un día y elegí qué hacés y cuánto tiempo tenés. El día más largo va a ser tu salida larga. Los días de <b>calidad</b> son los de intervalos fuertes: marcá 1 o 2 y no seguidos.</p>
            <WeekEditor days={p.days} onChangeDay={setDay} presets={PRESETS} onPreset={(pr) => set({ days: pr.days.map((d) => ({ ...d })) })} />
          </div>
        )}

        {step === 3 && (
          <div style={box}>
            <h1 style={h1}>Tu objetivo</h1>
            <p style={lead}>El plan se arma hacia una fecha o una meta. Elegí lo que mejor te describe; después podés sumar más en Ajustes.</p>
            <div className="wz-goals" role="radiogroup" aria-label="Tipo de objetivo">
              {([
                ["event", "Tengo una carrera", "Armamos el plan hacia esa fecha, con puesta a punto.", "event"],
                ["performance", "Meta de rendimiento", "Por ejemplo subir tu FTP de 280 a 300 W.", "performance"],
                ["general", "Mejorar en general", "Sin fecha ni meta: sumar forma de a poco.", "general"],
              ] as const).map(([k, t, d, ic]) => (
                <button key={k} type="button" role="radio" aria-checked={p.goal.mode === k} data-on={p.goal.mode === k} onClick={() => { buzz(); set({ goal: { ...p.goal, mode: k } }); }}>
                  <span className="wz-goal-ic"><Icon name={ic} size={20} /></span>
                  <span><b>{t}</b><small>{d}</small></span>
                </button>
              ))}
            </div>
            {p.goal.mode === "performance" && (
              <div className="wz-reveal">
                <div style={label}>¿Qué querés mejorar?</div>
                <Segmented ariaLabel="Qué querés mejorar" value={p.goal.metric} options={[{ value: "ftp", label: "FTP" }, { value: "p5", label: "Potencia 5 min" }, { value: "weight", label: "Peso" }] as const} onChange={(v) => set({ goal: { ...p.goal, metric: v } })} />
                <div style={{ fontSize: "13px", color: "var(--text-muted)", margin: "12px 0 10px" }}>
                  Hoy: <b style={{ color: "var(--text)" }}>{(p.goal.metric === "ftp" ? p.ftp : p.goal.metric === "p5" ? p.p5 : p.weight) || "sin dato"}{(p.goal.metric === "ftp" ? p.ftp : p.goal.metric === "p5" ? p.p5 : p.weight) ? (p.goal.metric === "weight" ? " kg" : " W") : ""}</b>
                  {!(p.goal.metric === "ftp" ? p.ftp : p.goal.metric === "p5" ? p.p5 : p.weight) && " · cargalo en el paso «Tu bici» (volvé con «Atrás»)"}
                </div>
                <label style={label} htmlFor="ob-gt">Tu meta ({p.goal.metric === "weight" ? "kg" : "watts"})</label>
                <input id="ob-gt" className="wz-num" style={{ ...input, marginBottom: "12px" }} inputMode="decimal" value={p.goal.target} onChange={(e) => set({ goal: { ...p.goal, target: e.target.value } })} placeholder={p.goal.metric === "weight" ? "Por ejemplo 65" : "Por ejemplo 300"} />
                <label style={label} htmlFor="ob-gd2">¿Para cuándo? (opcional)</label>
                <input id="ob-gd2" type="date" style={input} value={p.goal.date} onChange={(e) => set({ goal: { ...p.goal, date: e.target.value } })} />
              </div>
            )}
            {p.goal.mode === "event" && (
              <div className="wz-reveal">
                <label style={label} htmlFor="ob-gn">Nombre de la carrera</label>
                <input id="ob-gn" style={{ ...input, marginBottom: "12px" }} value={p.goal.name} onChange={(e) => set({ goal: { ...p.goal, name: e.target.value } })} placeholder="Por ejemplo Gran Fondo" />
                <label style={label} htmlFor="ob-gd">Fecha</label>
                <input id="ob-gd" type="date" style={{ ...input, marginBottom: "12px" }} value={p.goal.date} onChange={(e) => set({ goal: { ...p.goal, date: e.target.value } })} />
                <div style={label}>Importancia</div>
                <Segmented ariaLabel="Importancia" value={p.goal.priority} options={[{ value: "A", label: "A · la más importante" }, { value: "B", label: "B · importante" }, { value: "C", label: "C · para probarme" }] as const} onChange={(v) => set({ goal: { ...p.goal, priority: v } })} />
                <label style={{ ...label, marginTop: "12px" }} htmlFor="ob-gp">Tipo de recorrido</label>
                <select id="ob-gp" style={input} value={p.goal.profile} onChange={(e) => set({ goal: { ...p.goal, profile: e.target.value } })}>
                  {PROFILES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div style={box}>
            <h1 style={h1}>Tus límites</h1>
            <p style={lead}>Todo es opcional, pero ayuda a que el plan no te proponga algo que no podés o no querés hacer.</p>
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
            <h1 style={{ ...h1, marginBottom: "12px" }}>Revisá y enviá</h1>
            <WeekBars days={p.days} />
            {[
              ["Bici", `${p.ftp ? `FTP ${p.ftp} W` : "FTP sin definir (lo define tu coach)"}${p.p5 ? ` · 5 min ${p.p5} W` : ""}${p.weight ? ` · ${p.weight} kg` : ""}`, 1],
              ["Semana", `${cycling.length} días de bici · ${quality.length} de calidad · ${Math.floor(totalMin / 60)} h ${String(totalMin % 60).padStart(2, "0")} min${longest ? ` · larga el ${DAY_NAMES[longest.dayOfWeek].toLowerCase()}` : ""}`, 2],
              ["Objetivo", p.goal.mode === "event" ? `${p.goal.name || "—"} · ${p.goal.date || "sin fecha"} · prioridad ${p.goal.priority}` : p.goal.mode === "performance" ? `Meta: ${p.goal.metric === "ftp" ? "FTP" : p.goal.metric === "p5" ? "potencia de 5 min" : "peso"} a ${p.goal.target || "—"} ${p.goal.metric === "weight" ? "kg" : "W"}${p.goal.date ? ` para el ${p.goal.date}` : ""}` : "Mejorar en general", 3],
              ["Límites", [p.injuries, p.preferences].filter(Boolean).join(" · ") || "Sin límites cargados", 4],
            ].map(([k, v, s]) => (
              <div key={String(k)} style={{ display: "flex", gap: "12px", padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: "13.5px", alignItems: "baseline" }}>
                <div style={{ width: "74px", color: "var(--text-dim)", flexShrink: 0 }}>{k}</div>
                <div style={{ flex: 1 }}>{v}</div>
                <button type="button" onClick={() => go(Number(s))} style={{ background: "none", border: "none", color: "var(--teal)", fontSize: "12px", cursor: "pointer", padding: 0 }}>Editar</button>
              </div>
            ))}
            <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.55, margin: "14px 0 0" }}>
              {hasCoach ? `${coachName ?? "Tu coach"} va a revisar esto antes de armar tu plan y puede corregirlo.` : "Podés cambiar todo esto después en Ajustes."}
            </p>
          </div>
        )}
      </div>

      {error && <div role="alert" style={{ color: "var(--red)", fontSize: "13px", marginBottom: "10px" }}>{error}</div>}

      <div className="wz-actions">
        {step > 1 && <button type="button" className="btn btn-outline" disabled={pending} onClick={() => go(step - 1)}>Atrás</button>}
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={pending} onClick={next}>
          {pending ? "Guardando…" : step === 5 ? (hasCoach ? "Enviar a mi coach" : "Terminar") : "Siguiente"}
        </button>
      </div>
    </div>
  );
}
