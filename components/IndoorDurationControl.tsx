"use client";

import { useEffect, useState } from "react";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";

/**
 * "Pasar a rodillo" con selector de duración (barra). El valor inicial es el tope por defecto;
 * se recuerda la última elección por alumno en este dispositivo. Más de `warnMin` muestra un aviso suave, sin bloquear.
 */
export function IndoorDurationControl({
  action, workoutId, athleteId, minMin, maxMin, defaultMin, origMin, warnMin,
}: {
  action: (formData: FormData) => Promise<unknown> | unknown;
  workoutId: string;
  athleteId: string;
  minMin: number;
  maxMin: number;
  defaultMin: number;
  origMin: number;
  warnMin: number;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultMin);
  const key = `indoorMin:${athleteId}`;

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(key));
      if (saved >= minMin && saved <= maxMin) setValue(saved);
    } catch { /* sin almacenamiento: queda el valor por defecto */ }
  }, [key, minMin, maxMin]);

  if (!open) {
    return <button type="button" className="session-action" onClick={() => setOpen(true)}>Pasar a rodillo</button>;
  }

  const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")} min` : ""}` : `${m} min`);
  const slim = minMin >= maxMin;

  return (
    <ActionForm action={action} success="Sesión pasada a rodillo" style={{ display: "block", width: "100%", border: "1px solid var(--border)", borderRadius: "14px", padding: "14px", background: "rgba(255,255,255,.03)" }}>
      <input type="hidden" name="workoutId" value={workoutId} />
      <input type="hidden" name="durationMin" value={value} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px" }}>
        <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)" }}>Duración en rodillo</span>
        <b style={{ fontSize: "18px" }}>{fmt(value)}</b>
      </div>
      {!slim && (
        <input
          type="range" min={minMin} max={maxMin} step={5} value={value}
          aria-label="Duración en rodillo en minutos"
          onChange={(e) => { const v = Number(e.target.value); setValue(v); try { localStorage.setItem(key, String(v)); } catch { /* ignorar */ } }}
          style={{ width: "100%", marginTop: "10px", accentColor: "var(--teal)" }}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "var(--text-dim)", marginTop: "2px" }}>
        <span>{fmt(minMin)} (mínimo de la sesión)</span><span>{fmt(maxMin)}{origMin === maxMin ? " (original)" : ""}</span>
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px", lineHeight: 1.45 }}>
        {value < origMin ? "Se recorta el volumen de Z2 primero; las series y el trabajo intenso se cuidan." : "Queda con la duración original."}
        {value > warnMin ? ` Más de ${warnMin} min en rodillo suele costar más sostenerlo (calor, posición fija): igual podés elegirlo.` : ""}
      </div>
      <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
        <SubmitButton className="session-action accent" pendingText="Aplicando…">Pasar a rodillo</SubmitButton>
        <button type="button" className="session-action" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </ActionForm>
  );
}
