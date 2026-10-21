"use client";

import { useState } from "react";

export const DAY_NAMES: Record<number, string> = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 0: "Domingo" };
export const ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_LETTER: Record<number, string> = { 1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S", 0: "D" };
export const TYPES = [
  { value: "cycling", label: "Bici", icon: "cycling" },
  { value: "gym", label: "Gimnasio", icon: "gym" },
  { value: "flexibility", label: "Movilidad", icon: "flexibility" },
  { value: "rest", label: "Descanso", icon: "rest" },
] as const;
export const PRESET_MIN = [45, 60, 90, 120, 180, 240];

export type Day = { dayOfWeek: number; type: "cycling" | "gym" | "flexibility" | "rest"; quality: boolean; min: string };
export type WeekPreset = { label: string; days: Day[] };

/** Cambia un día respetando las reglas: solo la bici puede ser de calidad, el descanso no lleva minutos y al cambiar de tipo se sugiere una duración. */
export function patchDay(day: Day, patch: Partial<Day>): Day {
  const n = { ...day, ...patch };
  if (n.type !== "cycling") n.quality = false;
  if (n.type === "rest") n.min = "";
  else if (patch.type && n.min === "") n.min = patch.type === "cycling" ? "60" : patch.type === "gym" ? "60" : "20";
  return n;
}

/** Números de la semana y los avisos que se derivan de ella (los usa el editor y quien lo contiene para validar). */
export function weekStats(days: Day[]) {
  const cycling = days.filter((d) => d.type === "cycling");
  const quality = cycling.filter((d) => d.quality);
  const totalMin = cycling.reduce((s, d) => s + (Number(d.min) || 0), 0);
  const badMin = cycling.some((d) => !(Number(d.min) >= 15 && Number(d.min) <= 600));
  const adjacent = quality.some((a) => quality.some((b) => a !== b && Math.min(Math.abs(a.dayOfWeek - b.dayOfWeek), 7 - Math.abs(a.dayOfWeek - b.dayOfWeek)) < 2));
  const longest = cycling.reduce<Day | null>((m, d) => (!m || Number(d.min) > Number(m.min) ? d : m), null);
  const gymBeforeLong = !!longest && days.some((d) => d.type === "gym" && (d.dayOfWeek + 1) % 7 === longest.dayOfWeek);
  return { cycling, quality, totalMin, badMin, adjacent, longest, gymBeforeLong };
}

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
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICON_PATH[name]}</svg>;
}
export const buzz = () => { try { navigator.vibrate?.(8); } catch { /* sin vibración */ } };


export const pill = (on: boolean): React.CSSProperties => ({ padding: "8px 12px", borderRadius: "999px", fontSize: "13px", fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? "var(--teal)" : "var(--border)"}`, background: on ? "rgba(79,209,197,.14)" : "transparent", color: on ? "var(--teal)" : "var(--text-muted)" });

/** Control segmentado: una sola fila, con ícono arriba y texto abajo */
export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: readonly { value: T; label: string; icon?: string }[]; onChange: (v: T) => void; ariaLabel: string }) {
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
export function WeekBars({ days, selected, onSelect }: { days: Day[]; selected?: number; onSelect?: (d: number) => void }) {
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


/**
 * Editor de la semana tipo: tira de 7 días, editor del día elegido (tipo, minutos, calidad) y gráfico de carga con avisos.
 * Lo usan el asistente de puesta en marcha y Plan → Días de entrenamiento, para que se vean y se usen igual.
 */
export function WeekEditor({ days, onChangeDay, presets, onPreset }: { days: Day[]; onChangeDay: (dayOfWeek: number, patch: Partial<Day>) => void; presets?: WeekPreset[]; onPreset?: (p: WeekPreset) => void }) {
  const [sel, setSel] = useState(1);
  const { cycling, quality, totalMin, badMin, adjacent, longest, gymBeforeLong } = weekStats(days);
  const cur = days.find((d) => d.dayOfWeek === sel)!;
  const stepMin = (delta: number) => {
    const lo = cur.type === "cycling" ? 15 : 10, hi = cur.type === "cycling" ? 600 : 180;
    buzz();
    onChangeDay(sel, { min: String(Math.min(hi, Math.max(lo, (Number(cur.min) || 0) + delta))) });
  };
  return (
    <>
      {presets && onPreset && (
        <>
          <div style={{ fontSize: "12px", color: "var(--text-dim)", marginBottom: "6px" }}>Arrancar con una semana de ejemplo:</div>
          <div className="wz-scroll" aria-label="Semanas de ejemplo">
            {presets.map((pr) => <button key={pr.label} type="button" style={{ ...pill(false), whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => { buzz(); onPreset(pr); }}>{pr.label}</button>)}
          </div>
        </>
      )}

      <div className="wz-strip" role="tablist" aria-label="Días de la semana">
        {ORDER.map((dw) => {
          const d = days.find((x) => x.dayOfWeek === dw)!;
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
        <Segmented ariaLabel={`Qué hacés el ${DAY_NAMES[sel]}`} value={cur.type} options={TYPES} onChange={(v) => onChangeDay(sel, { type: v })} />
        {cur.type !== "rest" && (
          <>
            <div className="wz-stepper">
              <button type="button" onClick={() => stepMin(-15)} aria-label="15 minutos menos">−</button>
              <div><input aria-label={`Minutos ${DAY_NAMES[sel]}`} inputMode="numeric" value={cur.min} onChange={(e) => onChangeDay(sel, { min: e.target.value.replace(/\D/g, "").slice(0, 3) })} /><span>min</span></div>
              <button type="button" onClick={() => stepMin(15)} aria-label="15 minutos más">+</button>
            </div>
            <div className="wz-scroll" style={{ marginBottom: 0 }}>
              {(cur.type === "cycling" ? PRESET_MIN : [30, 45, 60, 90]).map((m) => <button key={m} type="button" style={{ ...pill(cur.min === String(m)), flexShrink: 0 }} onClick={() => { buzz(); onChangeDay(sel, { min: String(m) }); }}>{m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}` : `${m} min`}</button>)}
            </div>
          </>
        )}
        {cur.type === "cycling" && (
          <button type="button" role="switch" aria-checked={cur.quality} className="wz-switch" onClick={() => { buzz(); onChangeDay(sel, { quality: !cur.quality }); }}>
            <span><b>Día de calidad</b><small>Intervalos fuertes ese día</small></span>
            <i data-on={cur.quality} aria-hidden />
          </button>
        )}
        <button type="button" className="wz-nextday" onClick={() => { buzz(); setSel(ORDER[(ORDER.indexOf(sel) + 1) % 7]); }}>Siguiente día →</button>
      </div>

      <WeekBars days={days} selected={sel} onSelect={(d) => { buzz(); setSel(d); }} />
      <div className="wz-legend"><span><i style={{ background: "var(--teal)" }} />Bici</span><span><i style={{ background: "var(--amber)" }} />Calidad</span><span><i style={{ background: "var(--blue)" }} />Gimnasio / movilidad</span></div>
      <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "10px" }}>
        {cycling.length} día{cycling.length === 1 ? "" : "s"} de bici · {quality.length} de calidad · {Math.floor(totalMin / 60)} h {String(totalMin % 60).padStart(2, "0")} min por semana{longest ? ` · salida larga: ${DAY_NAMES[longest.dayOfWeek]}` : ""}
      </div>
      {adjacent && <div className="wz-warn">Marcaste días de calidad seguidos: hacen falta 48 h entre sesiones fuertes, así que uno pasará a rodaje suave.</div>}
      {quality.length === 0 && cycling.length > 0 && <div className="wz-warn">No marcaste ningún día de calidad: todas las salidas serían suaves.</div>}
      {gymBeforeLong && <div className="wz-warn">Hay gimnasio el día antes de la salida larga: puede llegar cansado.</div>}
      {cycling.length === 1 && quality.length === 1 && <div className="wz-warn">Con un solo día de bici, esa salida concentra toda la intensidad de la semana. Si podés, sumá un segundo día de rodaje suave.</div>}
      {badMin && <div className="wz-warn" style={{ color: "var(--red)" }}>Cada día de bici necesita entre 15 y 600 minutos.</div>}
    </>
  );
}
