/** Esqueleto de carga: mantiene la forma de la pantalla (título, tarjeta grande y fichas) mientras llegan los datos */
export function PageSkeleton({ title = true, tiles = 3 }: { title?: boolean; tiles?: number }) {
  return (
    <div className="sk-page" role="status" aria-label="Cargando">
      {title && <div className="skeleton sk-line" style={{ width: "42%", height: "26px", marginBottom: "18px" }} />}
      <div className="skeleton sk-card" />
      <div className="sk-row">{Array.from({ length: tiles }, (_, i) => <div key={i} className="skeleton sk-tile" />)}</div>
      <div className="skeleton sk-line" style={{ width: "70%" }} />
      <div className="skeleton sk-line" style={{ width: "55%" }} />
    </div>
  );
}
