type Status = "GREEN" | "AMBER" | "RED";

const META: Record<Status, { color: string; soft: string; label: string; advice: string }> = {
  GREEN: { color: "#4FD1C5", soft: "rgba(79,209,197,.14)", label: "Disponibilidad alta", advice: "Podés hacer la sesión como está planificada." },
  AMBER: { color: "#E8A33D", soft: "rgba(232,163,61,.14)", label: "Disponibilidad moderada", advice: "Hacé la sesión con cuidado; si el cuerpo no responde, bajá la intensidad." },
  RED: { color: "#E5636A", soft: "rgba(229,99,106,.14)", label: "Disponibilidad baja", advice: "Priorizá recuperar: rodaje suave o descanso." },
};

// Arco de 270° (de 135° a 405°), abierto abajo.
const R = 78;
const CX = 100;
const CY = 100;
const START = 135;
const SWEEP = 270;

const pt = (deg: number, r = R) => {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const;
};
const arc = (from: number, to: number, r = R) => {
  const [x1, y1] = pt(from, r);
  const [x2, y2] = pt(to, r);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};
const degAt = (score: number) => START + (Math.max(0, Math.min(100, score)) / 100) * SWEEP;

/** Hero de disponibilidad: el semáforo manda; el número (0–100) se mueve dentro de la banda del estado. */
export function AvailabilityRing({
  status,
  score,
  reasons,
  missing = [],
}: {
  status: Status;
  score: number;
  reasons: string[];
  missing?: string[];
}) {
  const m = META[status];
  const end = degAt(score);
  const [kx, ky] = pt(end);
  const gid = `g-${status}`;

  return (
    <div className="avail-hero" style={{ ["--c" as string]: m.color, ["--soft" as string]: m.soft }}>
      <div className="avail-gauge">
        <svg viewBox="0 0 200 200" role="img" aria-label={`Disponibilidad ${score} de 100, ${m.label.toLowerCase()}`}>
          <defs>
            <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor={m.color} stopOpacity=".35" />
              <stop offset="1" stopColor={m.color} />
            </linearGradient>
          </defs>
          <path d={arc(START, START + SWEEP)} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="12" strokeLinecap="round" />
          {/* Límites de zona: 50 y 75 */}
          {[50, 75].map((t) => {
            const [x1, y1] = pt(degAt(t), R - 11);
            const [x2, y2] = pt(degAt(t), R + 11);
            return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--bg)" strokeWidth="2.5" />;
          })}
          {score > 0 && <path d={arc(START, end)} fill="none" stroke={`url(#${gid})`} strokeWidth="12" strokeLinecap="round" />}
          <circle cx={kx} cy={ky} r="9" fill="var(--bg)" opacity=".9" />
          <circle cx={kx} cy={ky} r="5.5" fill={m.color} />
        </svg>
        <div className="avail-score">
          <div className="avail-num">{Math.round(score)}</div>
          <div className="avail-of">de 100</div>
        </div>
      </div>

      <div className="avail-body">
        <span className="avail-pill">{m.label}</span>
        <p className="avail-advice">{m.advice}</p>
        <ul className="avail-reasons">
          {reasons.slice(0, 3).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <p className="avail-note">
          El estado (alta, moderada, baja) sale de reglas sobre tu HRV, tu FC en reposo, tu forma y tu check-in. El número es una
          referencia dentro de ese estado, no una medida validada.
          {missing.length > 0 && <> Sin dato hoy: {missing.join(", ")}.</>}
        </p>
      </div>
    </div>
  );
}
