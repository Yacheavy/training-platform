"use client";

import { useEffect, useState } from "react";

/**
 * Ayuda de «primera vez»: se muestra sola hasta que se la cierra (se recuerda en este navegador) y después queda un enlace discreto
 * para volver a verla. El recuerdo vive solo en el navegador: si no se puede guardar, simplemente vuelve a aparecer.
 */
export function FirstTimeTip({ id, title, children, linkText = "¿Cómo se lee esto?" }: { id: string; title: string; children: React.ReactNode; linkText?: string }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { setOpen(!window.localStorage.getItem(`tip:${id}`)); } catch { setOpen(true); }
    setReady(true);
  }, [id]);
  const close = () => {
    setOpen(false);
    try { window.localStorage.setItem(`tip:${id}`, "1"); } catch { /* sin almacenamiento: vuelve a aparecer */ }
  };
  if (!ready) return null;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label={`Ayuda: ${title}`} style={{ background: "none", border: "none", padding: "4px 0", margin: "0 0 10px", color: "var(--text-dim)", fontSize: "12px", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}>
        {linkText}
      </button>
    );
  }
  return (
    <div role="note" style={{ background: "rgba(79,209,197,.08)", border: "1px solid rgba(79,209,197,.35)", borderRadius: "14px", padding: "14px 16px", margin: "0 0 14px" }}>
      <div style={{ fontSize: "13.5px", fontWeight: 600, marginBottom: "6px" }}>{title}</div>
      <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.55 }}>{children}</div>
      <button type="button" onClick={close} className="btn btn-sm" style={{ marginTop: "10px" }}>Entendido</button>
    </div>
  );
}
