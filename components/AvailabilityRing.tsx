import type { SignalChip } from "@/lib/training-engine/availability-score";

type Status = "GREEN" | "AMBER" | "RED";

const META: Record<Status, { color: string; soft: string; label: string; advice: string }> = {
  GREEN: { color: "var(--teal)", soft: "rgba(79,209,197,.14)", label: "Disponibilidad alta", advice: "Podés hacer la sesión como está planificada." },
  AMBER: { color: "var(--amber)", soft: "rgba(232,163,61,.14)", label: "Disponibilidad moderada", advice: "Hacé la sesión con cuidado; si el cuerpo no responde, bajá la intensidad." },
  RED: { color: "var(--red)", soft: "rgba(229,99,106,.14)", label: "Disponibilidad baja", advice: "Priorizá recuperar: rodaje suave o descanso." },
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
  alertReasons,
  chips,
  insufficient = false,
  sources = [],
  ageDays = null,
  attention = false,
  hideReasons = false,
}: {
  status: Status;
  score: number;
  /** Solo motivos de alerta (y aviso de dato viejo). Vacío = no hay nada que explicar. */
  alertReasons: string[];
  chips: SignalChip[];
  insufficient?: boolean;
  /** Señales de recuperación con las que se calculó (HRV, FC de reposo, check-in). */
  sources?: string[];
  /** Días desde el último dato de HRV/FC (0 = hoy). */
  ageDays?: number | null;
  /** Hay un aviso de atención (HRV muy bajo + FC alta hoy): el consejo no puede decir solo «todo bien». */
  attention?: boolean;
  /** La tarjeta de guía del día ya detalla los motivos: no se repiten acá. */
  hideReasons?: boolean;
}) {
  if (insufficient) return <InsufficientHero />;
  const m = META[status];
  const end = degAt(score);
  const [kx, ky] = pt(end);
  const gid = `g-${status}`;
  const alerts = chips.filter((c) => c.state === "alert").length;
  const stale = ageDays != null && ageDays >= 1 ? (ageDays === 1 ? "de ayer" : `de hace ${ageDays} d`) : null;
  const okText = (c: SignalChip) => (stale && (c.key === "hrv" || c.key === "resting_hr") ? `Normal · ${stale}` : "Normal");

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
          {score > 0 && <path className="avail-arc" pathLength={1} d={arc(START, end)} fill="none" stroke={`url(#${gid})`} strokeWidth="12" strokeLinecap="round" />}
          <g className="avail-knob">
            <circle cx={kx} cy={ky} r="9" fill="var(--bg)" opacity=".9" />
            <circle cx={kx} cy={ky} r="5.5" fill={m.color} />
          </g>
        </svg>
        <div className="avail-score">
          <div className="avail-num">{Math.round(score)}</div>
          <div className="avail-of">de 100</div>
        </div>
      </div>

      <div className="avail-body">
        <span className="avail-pill">{m.label}</span>
        <p className="avail-advice">{attention && status === "GREEN" ? "Podés hacer la sesión como está planificada, pero prestá atención a tus señales de hoy." : m.advice}</p>
        <ul className="avail-chips" aria-label="Estado de cada señal">
          {chips.map((c) => (
            <li key={c.key} className={`avail-chip ${c.state}`}>
              <span className="avail-dot" aria-hidden="true" />
              <span>
                <span className="avail-chip-name">{c.label}</span>
                <span className="avail-chip-state">{c.state === "alert" ? "En alerta" : c.state === "watch" ? (c.detail ?? "Hoy fuera de lo habitual") : c.state === "nodata" ? "Sin dato hoy" : okText(c)}</span>
              </span>
            </li>
          ))}
        </ul>
        {alertReasons.length > 0 && !hideReasons && (
          <ul className="avail-reasons">
            {alertReasons.slice(0, 3).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
        <details className="avail-how">
          <summary>
            <span>
              {alerts === 0 ? "Sin alertas" : alerts === 1 ? "Una señal en alerta" : `${alerts} señales en alerta`} · calculado con {sources.length} de 3
            </span>
            <span className="avail-how-link">Cómo se calcula</span>
          </summary>
          <div className="avail-note">
            <p>El estado (alta, moderada, baja) sale de reglas sobre cuatro señales:</p>
            <ul>
              <li>HRV y FC en reposo: se compara la media de tus últimos 7 días con tu línea base de 60 días. Es alerta si sale de tu rango habitual.</li>
              <li>Check-in: sueño, fatiga, estrés y dolor muscular; cuentan como una sola señal.</li>
              <li>Forma (TSB): se toma al empezar el día (cierre de ayer, sin la sesión de hoy) y alerta si baja de tu mínimo configurado.</li>
            </ul>
            <p>Una sola señal da moderada; baja exige dos coincidiendo (o forma baja más una). El número es una referencia dentro del estado, no una medida validada.</p>
          </div>
        </details>
      </div>
    </div>
  );
}

/** Estado neutro: sin HRV, FC de reposo ni check-in no hay de dónde decidir, así que no se muestra un verde ni un número. */
function InsufficientHero() {
  return (
    <div className="avail-hero" style={{ ["--c" as string]: "#8A97A6", ["--soft" as string]: "rgba(138,151,166,.12)" }}>
      <div className="avail-gauge">
        <svg viewBox="0 0 200 200" role="img" aria-label="Disponibilidad sin datos suficientes">
          <path d={arc(START, START + SWEEP)} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="12" strokeLinecap="round" strokeDasharray="2 14" />
        </svg>
        <div className="avail-score">
          <div className="avail-num" style={{ fontSize: "34px" }}>—</div>
          <div className="avail-of">sin datos</div>
        </div>
      </div>
      <div className="avail-body">
        <span className="avail-pill">Sin datos suficientes</span>
        <p className="avail-advice">Hoy no hay datos de recuperación para evaluar tu disponibilidad. La sesión sigue como está planificada.</p>
        <ul className="avail-reasons">
          <li>Completá el check-in de hoy (sueño, fatiga, estrés y dolor): es lo único que hace falta si no tenés HRV ni FC de reposo.</li>
        </ul>
        <p className="avail-note">No mostramos un número cuando no hay ninguna señal: sería inventarlo.</p>
      </div>
    </div>
  );
}
