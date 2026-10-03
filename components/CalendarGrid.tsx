"use client";

import { useState } from "react";
import { WorkoutMiniChart } from "./WorkoutMiniChart";
import { moveWorkoutToDate, swapWorkouts } from "@/lib/calendar-actions";
import { getExecutionTips } from "@/lib/training-engine/execution-tips";

interface CalendarWorkout {
  id: string;
  date: string;
  workoutLibraryKey: string;
  status: string;
  estimatedTss: number | null;
  estimatedKj: number | null;
  suggestedCarbsG: number | null;
  rationale: string | null;
  blocksJson: { type: string; durationSec: number; targetWatts: number }[];
}

const STATUS_BORDER: Record<string, string> = {
  PLANNED: "var(--border)",
  SUGGESTED: "var(--teal-dim, #2A5C56)",
  EDITED: "var(--amber)",
  APPROVED: "var(--teal)",
  SENT_TO_INTERVALS: "var(--teal)",
  COMPLETED: "var(--text-dim)",
};

function estimateZoneMinutes(blocks: CalendarWorkout["blocksJson"], ftp: number) {
  const zones: Record<string, number> = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0, "Z6+": 0 };
  for (const b of blocks) {
    if (ftp <= 0) continue;
    const pct = (b.targetWatts / ftp) * 100;
    const min = b.durationSec / 60;
    if (pct < 55) zones.Z1 += min;
    else if (pct < 76) zones.Z2 += min;
    else if (pct < 88) zones.Z3 += min;
    else if (pct <= 105) zones.Z4 += min;
    else if (pct <= 120) zones.Z5 += min;
    else zones["Z6+"] += min;
  }
  return zones;
}

export function CalendarGrid({
  year,
  month,
  workouts,
  ftp,
}: {
  year: number;
  month: number;
  workouts: CalendarWorkout[];
  ftp: number;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [detailWorkout, setDetailWorkout] = useState<CalendarWorkout | null>(null);

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const workoutsByDate = new Map<string, CalendarWorkout>();
  for (const w of workouts) {
    const key = new Date(w.date).toISOString().split("T")[0];
    workoutsByDate.set(key, w);
  }

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  async function handleDrop(dayNumber: number) {
    if (!draggingId) return;
    const newDate = new Date(year, month, dayNumber);
    const targetKey = newDate.toISOString().split("T")[0];
    const existingAtTarget = workoutsByDate.get(targetKey);

    if (existingAtTarget && existingAtTarget.id !== draggingId) {
      await swapWorkouts(draggingId, existingAtTarget.id);
    } else {
      await moveWorkoutToDate(draggingId, newDate.toISOString());
    }
    setDraggingId(null);
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "4px", marginBottom: "6px" }}>
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
          <div key={d} style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-dim)", textAlign: "center" }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "4px" }}>
        {cells.map((dayNumber, idx) => {
          if (dayNumber == null) return <div key={idx} />;

          const dateKey = new Date(year, month, dayNumber).toISOString().split("T")[0];
          const workout = workoutsByDate.get(dateKey);
          const isToday = dateKey === new Date().toISOString().split("T")[0];

          return (
            <div
              key={idx}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(dayNumber)}
              style={{
                border: `1px solid ${isToday ? "var(--teal)" : "var(--border)"}`,
                borderRadius: "8px",
                padding: "6px",
                minHeight: "80px",
                background: isToday ? "rgba(79,209,197,.05)" : "var(--surface)",
              }}
            >
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-dim)", marginBottom: "4px" }}>
                {dayNumber}
              </div>
              {workout && (
                <div
                  draggable
                  onDragStart={() => setDraggingId(workout.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => setDetailWorkout(workout)}
                  style={{
                    cursor: "grab",
                    border: `1px solid ${STATUS_BORDER[workout.status] ?? "var(--border)"}`,
                    borderRadius: "6px",
                    padding: "5px",
                    background: "var(--surface-2)",
                  }}
                  title="Click para ver detalle - arrastra para mover"
                >
                  <div style={{ fontSize: "9.5px", color: "var(--text-muted)", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {workout.workoutLibraryKey}
                  </div>
                  <WorkoutMiniChart blocks={workout.blocksJson} />
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-dim)", marginTop: "3px" }}>
                    {workout.estimatedTss ? `${Math.round(workout.estimatedTss)} TSS` : ""}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {detailWorkout && (
        <div
          onClick={() => setDetailWorkout(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "24px",
              maxWidth: "480px",
              width: "90%",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "18px", fontWeight: 600 }}>
                {detailWorkout.workoutLibraryKey}
              </div>
              <button
                onClick={() => setDetailWorkout(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", gap: "20px", marginBottom: "16px", flexWrap: "wrap" }}>
              <MiniStat
                label="Duración"
                value={`${Math.round(detailWorkout.blocksJson.reduce((s, b) => s + b.durationSec, 0) / 60)}min`}
              />
              <MiniStat label="TSS" value={`${Math.round(detailWorkout.estimatedTss ?? 0)}`} />
              <MiniStat label="kJ" value={`${Math.round(detailWorkout.estimatedKj ?? 0)}`} />
              <MiniStat label="Carbos" value={`${detailWorkout.suggestedCarbsG ?? 0}g`} />
            </div>

            <div style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>
              Tiempo estimado en zonas
            </div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
              {Object.entries(estimateZoneMinutes(detailWorkout.blocksJson, ftp)).map(([zone, min]) =>
                min > 0.5 ? (
                  <div key={zone} style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", background: "var(--surface-2)", padding: "4px 8px", borderRadius: "6px" }}>
                    {zone}: {Math.round(min)}min
                  </div>
                ) : null
              )}
            </div>

            <div style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "6px" }}>
              Descripción
            </div>
            <div style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "16px" }}>
              {detailWorkout.rationale}
            </div>

            <div style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>
              Sugerencias de ejecución
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {getExecutionTips(detailWorkout.workoutLibraryKey).map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  <span style={{ color: "var(--teal)", flexShrink: 0 }}>→</span>
                  {tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", color: "var(--text-dim)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 600, marginTop: "2px" }}>{value}</div>
    </div>
  );
}