"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Key = "power" | "hr" | "cadence" | "speed" | "altitude";

interface Props {
  stepSec: number;
  power: (number | null)[];
  hr: (number | null)[];
  cadence: (number | null)[];
  speed: (number | null)[];
  altitude: (number | null)[];
  ftp?: number | null;
}

const DEFS: { key: Key; label: string; unit: string; color: string; smooth: boolean; dec: number }[] = [
  { key: "power", label: "Potencia", unit: "W", color: "#4FD1C5", smooth: true, dec: 0 },
  { key: "hr", label: "Frec. cardíaca", unit: "lpm", color: "#E5636A", smooth: true, dec: 0 },
  { key: "cadence", label: "Cadencia", unit: "rpm", color: "#E8A33D", smooth: true, dec: 0 },
  { key: "speed", label: "Velocidad", unit: "km/h", color: "#7AA7F7", smooth: true, dec: 1 },
  { key: "altitude", label: "Altitud", unit: "m", color: "#9AA5B4", smooth: false, dec: 0 },
];

const SMOOTH = [
  { label: "Sin suavizar", sec: 0 },
  { label: "30 s", sec: 30 },
  { label: "1 min", sec: 60 },
];

/** Promedio móvil centrado, ignorando huecos. */
function smooth(a: (number | null)[], win: number): (number | null)[] {
  if (win <= 1) return a;
  const half = Math.floor(win / 2);
  return a.map((v, i) => {
    if (v == null) return null;
    let s = 0, c = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(a.length - 1, i + half); j++) {
      const x = a[j];
      if (x != null) { s += x; c++; }
    }
    return c ? s / c : v;
  });
}

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function niceStep(max: number, target: number): number {
  const raw = max / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

const H = 250;
const PAD = { l: 40, r: 40, t: 12, b: 24 };

/**
 * Gráfico de la salida: potencia, FC, cadencia, velocidad y altitud en un mismo eje de tiempo.
 * Cada serie se dibuja con su propia escala; los ejes de los costados son los de las dos primeras series activas.
 * Al pasar el cursor (o deslizar el dedo) se ven los valores de ese momento. Las casillas muestran u ocultan cada dato.
 */
export function ActivityChart({ stepSec, power, hr, cadence, speed, altitude, ftp }: Props) {
  const raw: Record<Key, (number | null)[]> = { power, hr, cadence, speed, altitude };
  const available = DEFS.filter((d) => raw[d.key].some((v) => v != null));
  const [on, setOn] = useState<Record<Key, boolean>>({ power: true, hr: true, cadence: false, speed: false, altitude: false });
  const [smoothSec, setSmoothSec] = useState(30);
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, Math.round(el.clientWidth))));
    ro.observe(el);
    setW(Math.max(260, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);

  const n = Math.max(power.length, hr.length, cadence.length, speed.length, altitude.length);
  const total = (n - 1) * stepSec;
  const plotW = w - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const series = useMemo(() => {
    const win = Math.max(1, Math.round(smoothSec / stepSec));
    return DEFS.map((d) => {
      const base = raw[d.key];
      const vals = d.smooth ? smooth(base, win) : base;
      const nums = vals.filter((v): v is number => v != null);
      let lo = nums.length ? Math.min(...nums) : 0;
      let hi = nums.length ? Math.max(...nums) : 1;
      if (d.key === "power" || d.key === "cadence") lo = 0; // potencia y cadencia siempre desde 0
      if (d.key === "hr") lo = Math.max(0, Math.floor((lo - 5) / 10) * 10);
      if (hi - lo < 1) hi = lo + 1;
      // un poco de aire arriba
      hi = lo + (hi - lo) * 1.06;
      return { ...d, vals, lo, hi };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smoothSec, stepSec, power, hr, cadence, speed, altitude]);

  const active = series.filter((s) => on[s.key] && raw[s.key].some((v) => v != null));
  const x = (i: number) => PAD.l + (n > 1 ? (i / (n - 1)) * plotW : 0);
  const y = (s: { lo: number; hi: number }, v: number) => PAD.t + plotH - ((v - s.lo) / (s.hi - s.lo)) * plotH;

  const paths = active.map((s) => {
    let d = "";
    let pen = false;
    s.vals.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(s, v).toFixed(1)}`;
      pen = true;
    });
    return { s, d };
  });

  const tStep = niceStep(total, Math.max(3, Math.floor(plotW / 90)));
  const ticks: number[] = [];
  for (let t = 0; t <= total; t += tStep) ticks.push(t);

  const axisFor = (s: (typeof active)[number] | undefined) => {
    if (!s) return [];
    const st = niceStep(s.hi - s.lo, 4);
    const out: number[] = [];
    for (let v = Math.ceil(s.lo / st) * st; v <= s.hi; v += st) out.push(v);
    return out;
  };
  const left = active[0];
  const right = active[1];

  function indexFromEvent(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const i = Math.round(((px - PAD.l) / plotW) * (n - 1));
    return Math.max(0, Math.min(n - 1, i));
  }

  const tipOnRight = hover != null && x(hover) < w / 2;

  if (!available.length) return null;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
        {available.map((d) => (
          <button
            key={d.key}
            type="button"
            role="checkbox"
            aria-checked={on[d.key]}
            onClick={() => setOn((p) => ({ ...p, [d.key]: !p[d.key] }))}
            style={{
              display: "flex", alignItems: "center", gap: "7px", padding: "6px 11px", borderRadius: "999px", fontSize: "12.5px", cursor: "pointer",
              border: `1px solid ${on[d.key] ? d.color : "var(--border)"}`,
              background: on[d.key] ? `${d.color}1F` : "transparent",
              color: on[d.key] ? "var(--text)" : "var(--text-dim)",
            }}
          >
            <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: on[d.key] ? d.color : "transparent", border: `1.5px solid ${d.color}` }} />
            {d.label}
          </button>
        ))}
      </div>

      <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
        <svg
          width={w}
          height={H}
          viewBox={`0 0 ${w} ${H}`}
          style={{ display: "block", touchAction: "pan-y", userSelect: "none" }}
          onPointerMove={(e) => setHover(indexFromEvent(e))}
          onPointerDown={(e) => setHover(indexFromEvent(e))}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(null); }}
        >
          {axisFor(left).map((v) => (
            <g key={`l${v}`}>
              <line x1={PAD.l} x2={w - PAD.r} y1={y(left!, v)} y2={y(left!, v)} stroke="rgba(255,255,255,.06)" />
              <text x={PAD.l - 6} y={y(left!, v) + 3.5} textAnchor="end" fontSize="10" fill={left!.color} fontFamily="var(--font-mono)">{Math.round(v)}</text>
            </g>
          ))}
          {axisFor(right).map((v) => (
            <text key={`r${v}`} x={w - PAD.r + 6} y={y(right!, v) + 3.5} textAnchor="start" fontSize="10" fill={right!.color} fontFamily="var(--font-mono)">{Math.round(v)}</text>
          ))}
          {ticks.map((t) => (
            <text key={t} x={x(t / stepSec)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-dim)" fontFamily="var(--font-mono)">{fmtTime(t)}</text>
          ))}
          {ftp && on.power && left?.key === "power" && ftp < left.hi && (
            <g>
              <line x1={PAD.l} x2={w - PAD.r} y1={y(left, ftp)} y2={y(left, ftp)} stroke="var(--text-dim)" strokeDasharray="4 4" opacity=".6" />
              <text x={PAD.l + 4} y={y(left, ftp) - 4} fontSize="9.5" fill="var(--text-dim)" fontFamily="var(--font-mono)">FTP {ftp} W</text>
            </g>
          )}
          {paths.map(({ s, d }) => (
            <path key={s.key} d={d} fill="none" stroke={s.color} strokeWidth={s.key === "altitude" ? 1.2 : 1.6} strokeLinejoin="round" opacity={s.key === "altitude" ? 0.7 : 1} />
          ))}
          {hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + plotH} stroke="rgba(255,255,255,.35)" />
              {active.map((s) => {
                const v = s.vals[hover];
                return v == null ? null : <circle key={s.key} cx={x(hover)} cy={y(s, v)} r="4" fill={s.color} stroke="#0E141B" strokeWidth="1.5" />;
              })}
            </g>
          )}
        </svg>

        {hover != null && active.length > 0 && (
          <div
            style={{
              position: "absolute", top: "6px", pointerEvents: "none", minWidth: "128px",
              ...(tipOnRight ? { left: Math.min(w - 140, x(hover) + 12) } : { left: Math.max(4, x(hover) - 140) }),
              background: "rgba(14,20,27,.94)", border: "1px solid var(--border-strong)", borderRadius: "10px", padding: "8px 10px", fontSize: "12px",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: "5px" }}>{fmtTime(hover * stepSec)}</div>
            {active.map((s) => {
              const v = s.vals[hover];
              return (
                <div key={s.key} style={{ display: "flex", justifyContent: "space-between", gap: "14px", lineHeight: 1.55 }}>
                  <span style={{ color: s.color }}>{s.label}</span>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{v == null ? "—" : `${v.toFixed(s.dec)} ${s.unit}`}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
        <span>Suavizado:</span>
        {SMOOTH.filter((o) => o.sec === 0 || o.sec >= stepSec * 2).map((o) => (
          <button
            key={o.sec}
            type="button"
            onClick={() => setSmoothSec(o.sec)}
            style={{
              padding: "4px 10px", borderRadius: "999px", fontSize: "12px", cursor: "pointer",
              border: `1px solid ${smoothSec === o.sec ? "var(--teal)" : "var(--border)"}`,
              background: smoothSec === o.sec ? "rgba(79,209,197,.1)" : "transparent",
              color: smoothSec === o.sec ? "var(--teal)" : "var(--text-muted)",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
