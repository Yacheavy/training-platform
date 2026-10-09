"use client";

import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";

/** Aviso obligatorio la primera vez (o cuando cambia la política): hay que aceptar para usar la app. */
export function ConsentModal({ action, coachName }: { action: (formData: FormData) => Promise<unknown>; coachName: string }) {
  return (
    <div className="modal-backdrop" style={{ zIndex: 60 }} role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="modal-card">
        <div className="modal-badge">Antes de empezar</div>
        <h2 id="consent-title" style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.02em", margin: "10px 0 8px" }}>
          Tus datos, claros
        </h2>
        <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.55, margin: "0 0 12px" }}>
          Para armar tu plan, esta app guarda datos de tu entrenamiento y de tu salud (HRV, frecuencia cardíaca en reposo, sueño, tus check-ins y las salidas que traemos de Intervals).
        </p>
        <ul style={{ margin: "0 0 14px", paddingLeft: "18px", fontSize: "13.5px", color: "var(--text-muted)", lineHeight: 1.6 }}>
          <li>Los ve {coachName}, tu entrenador, para acompañarte. Nadie más.</li>
          <li>El asistente de chat envía a un servicio de IA (Anthropic) tus datos de entrenamiento para responderte, sin tu nombre ni tu email.</li>
          <li>Podés pedir ver, corregir o borrar tus datos cuando quieras.</li>
          <li>La app no reemplaza a un médico ni da diagnósticos.</li>
        </ul>
        <p style={{ fontSize: "13px", margin: "0 0 14px" }}>
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal)" }}>
            Leer la política de privacidad completa
          </a>
        </p>
        <ActionForm action={action} success={null} style={{ display: "grid", gap: "14px" }}>
          <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "13.5px", lineHeight: 1.5, cursor: "pointer" }}>
            <input type="checkbox" name="accept" style={{ marginTop: "3px", width: "18px", height: "18px", accentColor: "#4FD1C5", flexShrink: 0 }} required />
            <span>Leí la política de privacidad y acepto que se usen mis datos como se explica.</span>
          </label>
          <SubmitButton
            pendingText="Guardando…"
            style={{ background: "linear-gradient(135deg, #5BDDD1, #3DB8AD)", color: "#08201C", border: "none", borderRadius: "14px", padding: "13px 18px", fontSize: "15px", fontWeight: 600, boxShadow: "0 8px 20px -10px rgba(79,209,197,.7)", cursor: "pointer" }}
          >
            Aceptar y continuar
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
