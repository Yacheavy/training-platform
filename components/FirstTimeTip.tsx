"use client";

import { useState, useSyncExternalStore } from "react";

/**
 * Ayuda de «primera vez»: se muestra sola hasta que se la cierra (se recuerda en este navegador) y después queda un enlace discreto
 * para volver a verla. El recuerdo vive solo en el navegador: si no se puede guardar, simplemente vuelve a aparecer.
 */
const listeners = new Set<() => void>();
const memory = new Set<string>(); // si el navegador no deja guardar, al menos se recuerda mientras la pestaña esté abierta
const seen = (id: string): boolean => {
  if (memory.has(id)) return true;
  try { return !!window.localStorage.getItem(`tip:${id}`); } catch { return false; }
};
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

/** floating: cuando está cerrada se muestra solo un botón «?» redondo, posicionado arriba a la derecha del contenedor (que debe ser position: relative) */
export function FirstTimeTip({ id, title, children, linkText = "¿Cómo se lee esto?", floating = false }: { id: string; title: string; children: React.ReactNode; linkText?: string; floating?: boolean }) {
  // En el servidor no se sabe si ya la vio: no se dibuja nada hasta hidratar, así no parpadea
  const alreadySeen = useSyncExternalStore(subscribe, () => seen(id), () => null);
  const [reopened, setReopened] = useState(false);
  if (alreadySeen === null) return null;
  const open = !alreadySeen || reopened;
  const close = () => {
    setReopened(false);
    memory.add(id);
    try { window.localStorage.setItem(`tip:${id}`, "1"); } catch { /* sin almacenamiento: queda en memoria */ }
    listeners.forEach((l) => l());
  };
  if (!open && floating) {
    return (
      <button type="button" onClick={() => setReopened(true)} aria-label={`Ayuda: ${title}`} title={linkText} className="tip-q">?</button>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setReopened(true)} aria-label={`Ayuda: ${title}`} style={{ background: "none", border: "none", padding: "4px 0", margin: "0 0 10px", color: "var(--text-dim)", fontSize: "12px", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}>
        {linkText}
      </button>
    );
  }
  return (
    <div role="note" style={{ background: "rgba(79,209,197,.08)", border: "1px solid rgba(79,209,197,.35)", borderRadius: "14px", padding: "14px 16px", margin: "0 0 14px" }}>
      <div style={{ fontSize: "13.5px", fontWeight: 600, marginBottom: "6px" }}>{title}</div>
      <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.55 }}>{children}</div>
      <button type="button" onClick={close} className="btn btn-outline btn-sm" style={{ marginTop: "10px" }}>Entendido</button>
    </div>
  );
}
