"use client";

import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";

const input = {
  width: "100%",
  background: "var(--surface-3)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "12px 14px",
  color: "var(--text)",
  fontSize: "15px",
  outline: "none",
} as const;

/** Bienvenida: pide conectar Intervals la primera vez (el alumno puede posponerlo). */
export function ConnectIntervalsModal({
  name,
  error,
  connectAction,
  laterAction,
}: {
  name: string;
  error?: "invalid" | "rejected";
  connectAction: (formData: FormData) => Promise<unknown>;
  laterAction: () => Promise<unknown>;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ivl-title">
      <div className="modal-card">
        <div className="modal-badge">Último paso</div>
        <h2 id="ivl-title" style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.02em", margin: "10px 0 6px" }}>
          Hola{name ? `, ${name}` : ""}. Conectemos tu Intervals
        </h2>
        <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.55, margin: "0 0 16px" }}>
          La app lee de Intervals.icu tus salidas, tu HRV y tu carga para calcular cómo estás y armar tu plan, y le envía tus sesiones. Sin esta conexión el tablero queda vacío.
        </p>

        <ol className="modal-steps">
          <li>
            Entrá a{" "}
            <a href="https://intervals.icu/settings" target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal)" }}>
              intervals.icu/settings
            </a>{" "}
            y bajá hasta <b>Developer Settings</b>.
          </li>
          <li>
            Tocá <b>Generate API Key</b> (o copiá la que ya tengas).
          </li>
          <li>
            Tu <b>Athlete ID</b> (algo como <code>i12345</code>) aparece en esa misma página y en la dirección cuando estás en tu calendario.
          </li>
        </ol>

        <ActionForm action={connectAction} success={null} style={{ display: "grid", gap: "12px" }}>
          <input type="hidden" name="from" value="modal" />
          <div>
            <label style={{ fontSize: "12.5px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Athlete ID</label>
            <input name="athleteId" placeholder="i12345" autoComplete="off" required style={input} />
          </div>
          <div>
            <label style={{ fontSize: "12.5px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>API key</label>
            <input name="apiKey" type="password" placeholder="••••••••" autoComplete="off" required style={input} />
          </div>
          {error === "invalid" && <div style={{ fontSize: "12.5px", color: "var(--red)" }}>Revisá el Athlete ID (por ejemplo i12345) y la clave.</div>}
          {error === "rejected" && <div style={{ fontSize: "12.5px", color: "var(--red)" }}>Intervals rechazó esas credenciales. Verificá que sean las tuyas.</div>}
          <SubmitButton
            pendingText="Conectando y trayendo tus datos…"
            style={{ background: "linear-gradient(135deg, #5BDDD1, #3DB8AD)", color: "#08201C", border: "none", borderRadius: "14px", padding: "13px 18px", fontSize: "15px", fontWeight: 600, boxShadow: "0 8px 20px -10px rgba(79,209,197,.7)", cursor: "pointer" }}
          >
            Conectar Intervals
          </SubmitButton>
        </ActionForm>

        <p style={{ fontSize: "11.5px", color: "var(--text-dim)", lineHeight: 1.5, margin: "14px 0 0" }}>
          La clave se guarda cifrada y solo se usa para traer tus datos y enviar tus sesiones. Podés cambiarla o desconectarla cuando quieras en Ajustes.
        </p>
        <ActionForm action={laterAction} success={null}>
          <SubmitButton pendingText="…" style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "13px", marginTop: "10px", cursor: "pointer", padding: "6px 0" }}>
            Más tarde
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
