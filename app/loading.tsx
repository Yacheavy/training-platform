import { LogoMark, Wordmark } from "@/components/Logo";

/** Pantalla de carga al abrir la app: el isologo con el nombre, como en los mails. Se muestra mientras se sincroniza y se arma la primera pantalla. */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Cargando"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "22px", background: "#0B0E13" }}
    >
      <div className="splash-pulse">
        <LogoMark size={132} />
      </div>
      <Wordmark size={38} />
    </div>
  );
}
