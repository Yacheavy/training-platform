"use client";

import { useEffect, useState } from "react";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";
import { RatingFields } from "./RatingFields";
import type { PendingPostRide } from "@/lib/nutrition-data";

const field = {
  width: "100%", background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: "10px",
  padding: "10px 12px", color: "var(--text)", fontSize: "15px", outline: "none", fontFamily: "var(--font-mono)",
} as const;
const lab = { fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "5px" } as const;

/** Al abrir la app tras una salida: pide RPE, sensación y la alimentación que falte. «Ahora no» lo pospone hasta la próxima vez que se abra la app. */
export function PostRideModal({ p, action }: { p: PendingPostRide; action: (formData: FormData) => Promise<unknown> }) {
  const key = `postride-snooze:${p.id}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let snoozed = false;
    try { snoozed = sessionStorage.getItem(key) === "1"; } catch { /* sin almacenamiento: se muestra igual */ }
    setVisible(!snoozed);
  }, [key]);

  if (!visible) return null;
  const later = () => {
    try { sessionStorage.setItem(key, "1"); } catch { /* ignorar */ }
    setVisible(false);
  };
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pr-title">
      <PostRideCard p={p} action={action} onLater={later} />
    </div>
  );
}

/** Contenido del popup (separado para poder revisarlo sin depender del almacenamiento del navegador). */
export function PostRideCard({ p, action, onLater }: { p: PendingPostRide; action: (formData: FormData) => Promise<unknown>; onLater: () => void }) {
  const [touched, setTouched] = useState(false);
  return (
      <div className="modal-card" style={{ maxWidth: "520px" }}>
        <div className="modal-badge">Tu última salida</div>
        <h2 id="pr-title" style={{ fontSize: "21px", fontWeight: 600, letterSpacing: "-0.02em", margin: "10px 0 4px" }}>¿Cómo te fue?</h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5, margin: "0 0 16px" }}>
          {p.name ? `${p.name} · ` : ""}{p.dateLabel} · {p.minutes} min{p.tss != null ? ` · TSS ${Math.round(p.tss)}` : ""}
        </p>

        <ActionForm action={action} success="Listo, gracias" style={{ display: "grid", gap: "16px" }}>
          <input type="hidden" name="activityId" value={p.id} />
          <div onChange={() => setTouched(true)} style={{ display: "grid", gap: "16px" }}>
            {p.needsRating && <RatingFields onTouch={() => setTouched(true)} />}

            {p.needsNutrition && (
              <div className="rate-block">
                <input type="hidden" name="nutrition" value="1" />
                <div className="rate-title"><span>Alimentación durante la salida</span><span className="rate-value">Opcional</span></div>
                {p.targetGPerHour > 0 && (
                  <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "10px" }}>
                    Sugerido: <b style={{ color: "var(--text)" }}>{p.plannedG} g de carbohidratos</b> (~{Math.round(p.targetGPerHour)} g/h).
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={lab} htmlFor="pr-carbs">Carbohidratos (g)</label>
                    <input id="pr-carbs" name="carbsG" type="number" inputMode="numeric" min={0} max={400} placeholder="—" style={field} />
                  </div>
                  <div>
                    <label style={lab} htmlFor="pr-fluid">Líquido (ml)</label>
                    <input id="pr-fluid" name="fluidMl" type="number" inputMode="numeric" min={0} max={8000} step={50} placeholder="—" style={field} />
                  </div>
                </div>
                <details style={{ marginTop: "10px" }}>
                  <summary style={{ fontSize: "12px", color: "var(--teal)", cursor: "pointer" }}>Sodio y tolerancia digestiva</summary>
                  <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
                    <div style={{ maxWidth: "200px" }}>
                      <label style={lab} htmlFor="pr-sodium">Sodio (mg)</label>
                      <input id="pr-sodium" name="sodiumMg" type="number" inputMode="numeric" min={0} max={12000} step={50} placeholder="—" style={field} />
                    </div>
                    <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                      <legend style={{ ...lab, padding: 0 }}>Tolerancia digestiva</legend>
                      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", fontSize: "13px" }}>
                        {[[3, "Sin problemas"], [2, "Aceptable"], [1, "Con molestias"]].map(([v, l]) => (
                          <label key={v} style={{ display: "flex", gap: "6px", alignItems: "center", cursor: "pointer" }}>
                            <input type="radio" name="giComfort" value={v} /> {l}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                </details>
                {p.targetGPerHour > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <SubmitButton name="intent" value="planned" pendingText="Guardando…" style={{ background: "transparent", border: "1px solid var(--border-strong)", color: "var(--text)", borderRadius: "10px", padding: "8px 12px", fontSize: "12.5px" }}>
                      Consumí lo planificado ({p.plannedG} g)
                    </SubmitButton>
                  </div>
                )}
              </div>
            )}
          </div>

          <SubmitButton
            name="intent"
            value="save"
            pendingText="Guardando…"
            disabled={!touched}
            style={{ background: "linear-gradient(135deg, #5BDDD1, #3DB8AD)", color: "#08201C", border: "none", borderRadius: "14px", padding: "13px 18px", fontSize: "15px", fontWeight: 600, boxShadow: "0 8px 20px -10px rgba(79,209,197,.7)" }}
          >
            Guardar
          </SubmitButton>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
            <button type="button" onClick={onLater} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "13px", cursor: "pointer", padding: "4px 0" }}>
              Ahora no
            </button>
            <SubmitButton name="intent" value="skip" pendingText="…" style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: "13px", padding: "4px 0" }}>
              No quiero cargar esto
            </SubmitButton>
          </div>
          <p style={{ fontSize: "11.5px", color: "var(--text-dim)", lineHeight: 1.5, margin: 0 }}>
            El RPE y la sensación también se envían a tu actividad en Intervals. La alimentación la usa la IA para analizar tu salida.
          </p>
        </ActionForm>
      </div>
  );
}
