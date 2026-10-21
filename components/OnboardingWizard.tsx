"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveOnboardingStep, submitOnboarding, skipOnboarding, type OnboardingPayload } from "@/lib/onboarding-actions";

const DAY_NAMES: Record<number, string> = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 0: "Domingo" };
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LETTER: Record<number, string> = { 1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S", 0: "D" };
const TYPES = [
  { value: "cycling", label: "Bici", icon: "cycling" },
  { value: "gym", label: "Gimnasio", icon: "gym" },
  { value: "flexibility", label: "Movilidad", icon: "flexibility" },
  { value: "rest", label: "Descanso", icon: "rest" },
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

/** Valores leídos de Intervals (FTP de la configuración de ciclismo y mejor esfuerzo de 5 min de los últimos 90 días) */
export type IntervalsValues = { ftp: number | null; p5: number | null } | null;

/* ───────── Íconos (trazo simple, heredan el color) ───────── */
const ICON_PATH: Record<string, React.ReactNode> = {
  cycling: <><circle cx="5.5" cy="17" r="3.5" /><circle cx="18.5" cy="17" r="3.5" /><path d="M5.5 17 9 8h5l4.5 9M9 8 12 17M14 8l-1.5-3H10" /></>,
  gym: <><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></>,
  flexibility: <><circle cx="12" cy="5" r="2" /><path d="M12 8v5m0 0-3 6m3-6 3 6M7 11l5-3 5 3" /></>,
  rest: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
  event: <><path d="M5 21V4M5 5h11l-2 4 2 4H5" /></>,
  performance: <><path d="M3 17 9 11l4 4 8-8" /><path d="M15 7h6v6" /></>,
  general: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICON_PATH[name]}</svg>;
}
const buzz = () => { try { navigator.vibrate?.(8); } catch { /* sin vibración */ } };

const box: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "18px", padding: "20px", marginBottom: "14px" };
const input: React.CSSProperties = { width: "100%", background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px 14px", color: "var(--text)", fontSize: "15px", outline: "none" };
const label: React.CSSProperties = { display: "block", fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "6px" };
const h1: React.CSSProperties = { fontSize: "21px", fontWeight: 650, letterSpacing: "-0.01em", margin: "0 0 6px" };
const lead: React.CSSProperties = { fontSize: "13.5px", color: "var(--text-muted)", lineHeight: 1.55, margin: "0 0 16px" };
const pill = (on: boolean): React.CSSProperties => ({ padding: "8px 12px", borderRadius: "999px", fontSize: "13px", fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? "var(--teal)" : "var(--border)"}`, background: on ? "rgba(79,209,197,.14)" : "transparent", color: on ? "var(--teal)" : "var(--text-muted)" });

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

/** Control segmentado: una sola fila, con ícono arriba y texto abajo */
function Segmented<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: readonly { value: T; label: string; icon?: string }[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="wz-seg" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} data-on={value === o.value} onClick={() => { buzz(); onChange(o.value); }}>
          {o.icon && <Icon name={o.icon} size={18} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Gráfico de barras de la semana: minutos por día (bici en turquesa, gimnasio/movilidad en azul) */
function WeekBars({ days, selected, onSelect }: { days: Day[]; selected?: number; onSelect?: (d: number) => void }) {
  const max = Math.max(120, ...days.map((d) => Number(d.min) || 0));
  return (
    <div className="wz-bars" role="img" aria-label="Minutos de entrenamiento por día">
      {ORDER.map((dw) => {
        const d = days.find((x) => x.dayOfWeek === dw)!;
        const m = d.type === "rest" ? 0 : Number(d.min) || 0;
        const h = m ? Math.max(8, Math.round((m / max) * 64)) : 3;
        const color = d.type === "cycling" ? (d.quality ? "var(--amber)" : "var(--teal)") : d.type === "rest" ? "var(--border)" : "var(--blue)";
        return (
          <button key={dw} type="button" className="wz-bar" data-sel={selected === dw} disabled={!onSelect} onClick={() => onSelect?.(dw)} aria-label={`${DAY_NAMES[dw]}: ${m ? `${m} min` : "descanso"}`}>
            <span className="wz-bar-min">{m ? (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}` : `${m}'`) : ""}</span>
            <span className="wz-bar-fill" style={{ height: `${h}px`, background: color }} />
            <span className="wz-bar-day">{DAY_LETTER[dw]}</span>
          </button>
        );
      })}
    </div>
  );
}

const wkgLevel = (v: number) => (v < 2 ? "En construcción" : v < 3 ? "Recreativo" : v < 4 ? "Entrenado" : "Avanzado");

export function OnboardingWizard({ initial, coachName, hasCoach, name, intervals = null }: { initial: OnboardingPayload; coachName: string | null; hasCoach: boolean; name: string; intervals?: IntervalsValues }) {
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<1 | -1>(1);
  const [sel, setSel] = useState(1);
  const [p, setP] = useState<OnboardingPayload>(initial);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reviewer: string | null } | null>(null);
  const [pending, start] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);

  // Al cambiar de paso vuelve arriba (la barra de acciones queda fija abajo)
  useEffect(() => { topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [step]);

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
  const cur = p.days.find((d) => d.dayOfWeek === sel)!;
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
  const stepMin = (delta: number) => {
    const lo = cur.type === "cycling" ? 15 : 10, hi = cur.type === "cycling" ? 600 : 180;
    const v = Math.min(hi, Math.max(lo, (Number(cur.min) || 0) + delta));
    buzz();
    setDay(sel, { min: String(v) });
  };

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
            <div style={{ fontSize: "12px", color: "var(--text-dim)", marginBottom: "6px" }}>Arrancar con una semana de ejemplo:</div>
            <div className="wz-scroll" aria-label="Semanas de ejemplo">
              {PRESETS.map((pr) => <button key={pr.label} type="button" style={{ ...pill(false), whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => { buzz(); set({ days: pr.days.map((d) => ({ ...d })) }); }}>{pr.label}</button>)}
            </div>

            <div className="wz-strip" role="tablist" aria-label="Días de la semana">
              {ORDER.map((dw) => {
                const d = p.days.find((x) => x.dayOfWeek === dw)!;
                return (
                  <button key={dw} type="button" role="tab" aria-selected={sel === dw} aria-label={`${DAY_NAMES[dw]}: ${TYPES.find((t) => t.value === d.type)!.label}${d.min ? ` ${d.min} min` : ""}`} data-sel={sel === dw} data-type={d.type} onClick={() => { buzz(); setSel(dw); }}>
                    <span className="wz-strip-l">{DAY_LETTER[dw]}</span>
                    <Icon name={d.type} size={18} />
                    {d.type === "cycling" && d.quality && <i className="wz-q" aria-hidden />}
                  </button>
                );
              })}
            </div>

            <div className="wz-editor" key={sel}>
              <div style={{ fontSize: "14px", fontWeight: 650, marginBottom: "10px" }}>{DAY_NAMES[sel]}</div>
              <Segmented ariaLabel={`Qué hacés el ${DAY_NAMES[sel]}`} value={cur.type} options={TYPES} onChange={(v) => setDay(sel, { type: v })} />
              {cur.type !== "rest" && (
                <>
                  <div className="wz-stepper">
                    <button type="button" onClick={() => stepMin(-15)} aria-label="15 minutos menos">−</button>
                    <div><input aria-label={`Minutos ${DAY_NAMES[sel]}`} inputMode="numeric" value={cur.min} onChange={(e) => setDay(sel, { min: e.target.value.replace(/\D/g, "").slice(0, 3) })} /><span>min</span></div>
                    <button type="button" onClick={() => stepMin(15)} aria-label="15 minutos más">+</button>
                  </div>
                  <div className="wz-scroll" style={{ marginBottom: 0 }}>
                    {(cur.type === "cycling" ? PRESET_MIN : [30, 45, 60, 90]).map((m) => <button key={m} type="button" style={{ ...pill(cur.min === String(m)), flexShrink: 0 }} onClick={() => { buzz(); setDay(sel, { min: String(m) }); }}>{m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}` : `${m} min`}</button>)}
                  </div>
                </>
              )}
              {cur.type === "cycling" && (
                <button type="button" role="switch" aria-checked={cur.quality} className="wz-switch" onClick={() => { buzz(); setDay(sel, { quality: !cur.quality }); }}>
                  <span><b>Día de calidad</b><small>Intervalos fuertes ese día</small></span>
                  <i data-on={cur.quality} aria-hidden />
                </button>
              )}
              <button type="button" className="wz-nextday" onClick={() => { buzz(); setSel(ORDER[(ORDER.indexOf(sel) + 1) % 7]); }}>Siguiente día →</button>
            </div>

            <WeekBars days={p.days} selected={sel} onSelect={(d) => { buzz(); setSel(d); }} />
            <div className="wz-legend"><span><i style={{ background: "var(--teal)" }} />Bici</span><span><i style={{ background: "var(--amber)" }} />Calidad</span><span><i style={{ background: "var(--blue)" }} />Gimnasio / movilidad</span></div>
            <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "10px" }}>
              {cycling.length} día{cycling.length === 1 ? "" : "s"} de bici · {quality.length} de calidad · {Math.floor(totalMin / 60)} h {String(totalMin % 60).padStart(2, "0")} min por semana{longest ? ` · salida larga: ${DAY_NAMES[longest.dayOfWeek]}` : ""}
            </div>
            {adjacent && <div className="wz-warn">Marcaste días de calidad seguidos: hacen falta 48 h entre sesiones fuertes, así que uno pasará a rodaje suave.</div>}
            {quality.length === 0 && cycling.length > 0 && <div className="wz-warn">No marcaste ningún día de calidad: todas las salidas serían suaves.</div>}
            {gymBeforeLong && <div className="wz-warn">Tenés gimnasio el día antes de tu salida larga: puede llegarte cansado. Tu coach lo va a revisar.</div>}
            {cycling.length === 1 && quality.length === 1 && <div className="wz-warn">Con un solo día de bici, esa salida concentra toda la intensidad de la semana. Si podés, sumá un segundo día de rodaje suave; si no, tu coach lo va a tener en cuenta.</div>}
            {badMin && <div className="wz-warn" style={{ color: "var(--red)" }}>Cada día de bici necesita entre 15 y 600 minutos.</div>}
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
