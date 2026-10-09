/** Línea mínima con relleno degradado (SVG puro, sin librerías). Ignora los huecos (null). */
export function Sparkline({ values, color = "#4FD1C5", id }: { values: (number | null)[]; color?: string; id: string }) {
  const pts = values.map((v, i) => (v == null ? null : ([i, v] as const))).filter((p): p is readonly [number, number] => p != null);
  if (pts.length < 2) return null;
  const W = 120;
  const H = 26;
  const n = values.length - 1 || 1;
  const min = Math.min(...pts.map((p) => p[1]));
  const max = Math.max(...pts.map((p) => p[1]));
  const span = max - min || 1;
  const xy = pts.map(([i, v]) => [(i / n) * W, H - 3 - ((v - min) / span) * (H - 6)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)} ${H} L${xy[0][0].toFixed(1)} ${H} Z`;
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="2" fill={color} />
    </svg>
  );
}
