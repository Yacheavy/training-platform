"use client";

import { useMemo, useRef, useState } from "react";
import { ATHLETE_TZ, weekRangeLocal } from "@/lib/tz";
import { WeekList } from "./WeekList";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

interface PlanWorkout {
  id: string;
  date: string;
  workoutLibraryKey: string;
  status: string;
  estimatedTss: number | null;
  blocksJson: { type: string; durationSec: number; targetWatts: number }[];
  phase: "DELOAD" | "TAPER" | null;
}

/** Plan completo navegable semana a semana (con botones y deslizando en el celular). */
export function PlanNavigator({ workouts, nowISO }: { workouts: PlanWorkout[]; nowISO: string }) {
  const currentStart = useMemo(() => weekRangeLocal(new Date(nowISO)).start.getTime(), [nowISO]);

  // Rango de semanas con contenido (siempre incluye la actual)
  const { minOffset, maxOffset } = useMemo(() => {
    let min = 0;
    let max = 0;
    for (const w of workouts) {
      const off = Math.round((weekRangeLocal(new Date(w.date)).start.getTime() - currentStart) / WEEK_MS);
      if (off < min) min = off;
      if (off > max) max = off;
    }
    return { minOffset: min, maxOffset: max };
  }, [workouts, currentStart]);

  const [offset, setOffset] = useState(0);
  const [dir, setDir] = useState(1);
  const touchX = useRef<number | null>(null);

  const go = (next: number) => {
    const clamped = Math.max(minOffset, Math.min(maxOffset, next));
    if (clamped === offset) return;
    setDir(clamped > offset ? 1 : -1);
    setOffset(clamped);
  };

  const weekStart = currentStart + offset * WEEK_MS;
  const weekEnd = weekStart + WEEK_MS;
  const weekWorkouts = workouts.filter((w) => {
    const t = new Date(w.date).getTime();
    return t >= weekStart && t < weekEnd;
  });

  const totalMin = Math.round(
    weekWorkouts.reduce((s, w) => s + w.blocksJson.reduce((a, b) => a + b.durationSec, 0), 0) / 60
  );
  const totalTss = Math.round(weekWorkouts.reduce((s, w) => s + (w.estimatedTss ?? 0), 0));
  const phase = weekWorkouts.find((w) => w.phase)?.phase ?? null;

  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: ATHLETE_TZ });
  const totalWeeks = maxOffset - minOffset + 1;
  const position = offset - minOffset + 1;

  const navBtn = (disabled: boolean): React.CSSProperties => ({
    width: "36px",
    height: "36px",
    borderRadius: "9px",
    border: "1px solid var(--border)",
    background: "transparent",
    color: disabled ? "var(--text-dim)" : "var(--text)",
    fontSize: "16px",
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  return (
    <div
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 70) go(offset + (dx < 0 ? 1 : -1));
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <button type="button" className="btn" aria-label="Semana anterior" disabled={offset <= minOffset} onClick={() => go(offset - 1)} style={navBtn(offset <= minOffset)}>
          ‹
        </button>
        <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600 }}>
            {fmt(weekStart)} – {fmt(weekEnd - DAY_MS)}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--text-dim)", marginTop: "2px" }}>
            Semana {position} de {totalWeeks}
            {offset === 0 && <span style={{ color: "var(--teal)" }}> · actual</span>}
            {phase === "DELOAD" && <span style={{ color: "var(--amber)" }}> · descarga</span>}
            {phase === "TAPER" && <span style={{ color: "var(--amber)" }}> · puesta a punto</span>}
          </div>
        </div>
        <button type="button" className="btn" aria-label="Semana siguiente" disabled={offset >= maxOffset} onClick={() => go(offset + 1)} style={navBtn(offset >= maxOffset)}>
          ›
        </button>
      </div>

      {offset !== 0 && (
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          <button
            type="button"
            className="btn"
            onClick={() => go(0)}
            style={{ background: "transparent", border: "1px solid var(--teal)", color: "var(--teal)", borderRadius: "8px", padding: "5px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
          >
            Volver a esta semana
          </button>
        </div>
      )}

      <div key={offset} className="week-fade" style={{ ["--week-shift" as string]: `${dir * 10}px` }}>
        <WeekList workouts={weekWorkouts} weekStartISO={new Date(weekStart).toISOString()} todayISO={nowISO} />
      </div>

      <div style={{ display: "flex", gap: "16px", justifyContent: "flex-end", marginTop: "10px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
        <span>{weekWorkouts.length} sesiones</span>
        <span>{Math.floor(totalMin / 60)}h {String(totalMin % 60).padStart(2, "0")}min</span>
        <span>{totalTss} TSS</span>
      </div>
    </div>
  );
}
