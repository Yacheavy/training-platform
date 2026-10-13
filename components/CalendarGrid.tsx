"use client";

import { STIMULUS_LABELS } from "@/lib/labels";

import { useEffect, useState } from "react";
import { dateKeyLocal } from "@/lib/tz";
import type { CalendarEvent } from "@/lib/calendar-data";
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
  readOnly = false,
  detailBase,
  events = [],
}: {
  year: number;
  month: number;
  workouts: CalendarWorkout[];
  ftp: number;
  /** Vista del entrenador: sin arrastrar ni mover sesiones del alumno. */
  readOnly?: boolean;
  /** Si se pasa (ej. "/workouts/"), el detalle muestra un link a la sesión completa: base + id. (Es un texto, no una función: viene de un componente de servidor.) */
  detailBase?: string;
  /** Carreras y metas con fecha (se muestran en su día). */
  events?: CalendarEvent[];
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [detailWorkout, setDetailWorkout] = useState<CalendarWorkout | null>(null);
  const todayKey = dateKeyLocal(new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [narrow, setNarrow] = useState(false);
  // Semana (domingo a sábado, igual que la grilla): la de hoy si el mes mostrado es el actual, si no la primera del mes
  const [weekStart, setWeekStart] = useState(() => {
    const inMonth = todayKey.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`);
    const base = inMonth ? todayKey : keyOf(year, month, 1);
    return addDays(base, -dow(base));
  });
  // En el celular se abre en semana (la grilla mensual de 7 columnas queda muy chica)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setNarrow(mq.matches);
    if (mq.matches) setView("week");
    const on = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const e of events) eventsByDate.set(e.date, [...(eventsByDate.get(e.date) ?? []), e]);
  const monthFirst = keyOf(year, month, 1);
  const monthLast = keyOf(year, month + 1, 0);
  const canPrevWeek = addDays(weekStart, -7) >= addDays(monthFirst, -6);
  const canNextWeek = addDays(weekStart, 7) <= monthLast;

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
    if (readOnly || !draggingId) return;
    const newDate = new Date(year, month, dayNumber);
    const targetKey = keyOf(year, month, dayNumber);
    const existingAtTarget = workoutsByDate.get(targetKey);

    if (existingAtTarget && existingAtTarget.id !== draggingId) {
      await swapWorkouts(draggingId, existingAtTarget.id);
    } else {
      await moveWorkoutToDate(draggingId, newDate.toISOString());
    }
    setDraggingId(null);
  }

  const seg = (active: boolean) => ({
    padding: "7px 16px", fontSize: "13px", cursor: "pointer", border: "1px solid var(--border)", color: active ? "var(--teal)" : "var(--text-muted)",
    background: active ? "rgba(79,209,197,.12)" : "transparent",
  }) as const;
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = `${fmtShort(weekDays[0])} – ${fmtShort(weekDays[6])}`;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
        <div role="group" aria-label="Vista del calendario" style={{ display: "inline-flex" }}>
          <button type="button" onClick={() => setView("week")} aria-pressed={view === "week"} style={{ ...seg(view === "week"), borderRadius: "999px 0 0 999px" }}>Semana</button>
          <button type="button" onClick={() => setView("month")} aria-pressed={view === "month"} style={{ ...seg(view === "month"), borderRadius: "0 999px 999px 0", borderLeft: "none" }}>Mes</button>
        </div>
        {view === "week" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button type="button" disabled={!canPrevWeek} onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semana anterior" style={{ ...seg(false), borderRadius: "999px", opacity: canPrevWeek ? 1 : 0.4 }}>←</button>
            <span style={{ fontSize: "13px", minWidth: "128px", textAlign: "center" }}>{weekLabel}</span>
            <button type="button" disabled={!canNextWeek} onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Semana siguiente" style={{ ...seg(false), borderRadius: "999px", opacity: canNextWeek ? 1 : 0.4 }}>→</button>
          </div>
        )}
      </div>

      {view === "week" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {weekDays.map((k) => {
            const w = workoutsByDate.get(k);
            const ev = eventsByDate.get(k) ?? [];
            const isToday = k === todayKey;
            const inMonth = k >= monthFirst && k <= monthLast;
            return (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "54px minmax(0, 1fr)", gap: "10px", alignItems: "center", padding: "10px 12px", borderRadius: "14px", border: `1px solid ${isToday ? "rgba(79,209,197,.6)" : "rgba(255,255,255,.06)"}`, background: isToday ? "linear-gradient(160deg, rgba(79,209,197,.14), rgba(79,209,197,.03))" : "var(--grad-card)", opacity: inMonth ? 1 : 0.75 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: isToday ? "var(--teal)" : "var(--text-muted)", textTransform: "capitalize" }}>{DOW_LABELS[dow(k)]}</div>
                  <div style={{ fontSize: "20px", fontWeight: 600 }}>{Number(k.slice(8))}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
                  {ev.map((e, i) => <EventChip key={i} e={e} />)}
                  {w ? (
                    <button type="button" onClick={() => setDetailWorkout(w)} style={{ textAlign: "left", cursor: "pointer", border: `1px solid ${STATUS_BORDER[w.status] ?? "var(--border)"}`, borderRadius: "10px", padding: "8px 10px", background: "rgba(255,255,255,.04)", color: "inherit", width: "100%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "13px", fontWeight: 600 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{STIMULUS_LABELS[w.workoutLibraryKey] ?? w.workoutLibraryKey}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {w.workoutLibraryKey === "gym" || w.workoutLibraryKey === "flexibility" ? "" : `${Math.round(w.blocksJson.reduce((a, b) => a + b.durationSec, 0) / 60)} min${w.estimatedTss ? ` · ${Math.round(w.estimatedTss)} TSS` : ""}`}
                        </span>
                      </div>
                      <div style={{ marginTop: "6px" }}><WorkoutMiniChart blocks={w.blocksJson} /></div>
                    </button>
                  ) : ev.length === 0 ? (
                    <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>Sin sesión</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "month" && (
      <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "4px", marginBottom: "6px" }}>
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
          <div key={d} style={{ fontSize: "11.5px", color: "var(--text-muted)", textAlign: "center", fontWeight: 500 }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "4px" }}>
        {cells.map((dayNumber, idx) => {
          if (dayNumber == null) return <div key={idx} />;

          const dateKey = keyOf(year, month, dayNumber);
          const workout = workoutsByDate.get(dateKey);
          const dayEvents = eventsByDate.get(dateKey) ?? [];
          const isToday = dateKey === todayKey;

          return (
            <div
              key={idx}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(dayNumber)}
              style={{
                border: `1px solid ${isToday ? "rgba(79,209,197,.6)" : "rgba(255,255,255,.06)"}`,
                borderRadius: "14px",
                padding: "7px",
                minHeight: "88px",
                background: isToday ? "linear-gradient(160deg, rgba(79,209,197,.14), rgba(79,209,197,.03))" : "var(--grad-card)",
              }}
            >
              <div style={{ fontSize: "11.5px", fontWeight: isToday ? 700 : 500, color: isToday ? "var(--teal)" : "var(--text-muted)", marginBottom: "4px" }}>
                {dayNumber}
              </div>
              {dayEvents.map((e, i) => <EventChip key={i} e={e} compact />)}
              {workout && narrow && (
                <button type="button" onClick={() => setDetailWorkout(workout)} aria-label={`Ver sesión del día ${dayNumber}`} style={{ display: "block", width: "100%", border: `1px solid ${STATUS_BORDER[workout.status] ?? "var(--border)"}`, borderRadius: "8px", padding: "4px 2px", background: "rgba(255,255,255,.06)", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "9.5px", cursor: "pointer" }}>
                  {workout.estimatedTss ? Math.round(workout.estimatedTss) : "•"}
                </button>
              )}
              {workout && !narrow && (
                <div
                  draggable={!readOnly}
                  onDragStart={() => setDraggingId(workout.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => setDetailWorkout(workout)}
                  style={{
                    cursor: readOnly ? "pointer" : "grab",
                    border: `1px solid ${STATUS_BORDER[workout.status] ?? "var(--border)"}`,
                    borderRadius: "10px",
                    padding: "6px",
                    background: "rgba(255,255,255,.04)",
                  }}
                  title={readOnly ? "Click para ver el detalle" : "Click para ver detalle - arrastra para mover"}
                >
                  <div style={{ fontSize: "9.5px", color: "var(--text-muted)", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {STIMULUS_LABELS[workout.workoutLibraryKey] ?? workout.workoutLibraryKey}
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

      </>
      )}

      {detailWorkout && (
        <div
          onClick={() => setDetailWorkout(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6,9,13,.72)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--grad-card)",
              border: "1px solid rgba(255,255,255,.09)",
              boxShadow: "0 30px 80px -20px rgba(0,0,0,.8)",
              borderRadius: "22px",
              padding: "26px",
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
                aria-label="Cerrar"
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "18px", cursor: "pointer", padding: "6px 10px", margin: "-6px -10px 0 0" }}
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

            <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "8px" }}>
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

            <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "6px" }}>
              Descripción
            </div>
            <div style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "16px" }}>
              {detailWorkout.rationale}
            </div>

            {detailBase && (
              <a href={`${detailBase}${detailWorkout.id}`} className="btn btn-outline accent" style={{ display: "inline-block", marginBottom: "16px" }}>
                Ver la sesión completa →
              </a>
            )}

            <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "8px" }}>
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

const DOW_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** "YYYY-MM-DD" de un día del calendario, sin depender de la zona horaria del navegador. */
function keyOf(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}
function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return keyOf(y, m - 1, d + n);
}
function dow(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function fmtShort(key: string): string {
  return `${Number(key.slice(8))} ${MONTHS_SHORT[Number(key.slice(5, 7)) - 1]}`;
}

const PRIORITY_COLOR: Record<string, string> = { A: "var(--red)", B: "var(--amber)", C: "var(--teal)" };

/** Carrera (con su prioridad A/B/C) o meta de rendimiento en su día. */
function EventChip({ e, compact = false }: { e: CalendarEvent; compact?: boolean }) {
  const isRace = e.kind === "EVENT";
  const color = isRace ? PRIORITY_COLOR[e.priority] ?? "var(--amber)" : "var(--text-muted)";
  return (
    <div title={`${isRace ? "Carrera" : "Meta"} ${e.priority}: ${e.name}`} style={{ border: `1px solid ${color}`, color, borderRadius: "8px", padding: compact ? "1px 4px" : "5px 9px", fontSize: compact ? "9px" : "12px", fontWeight: 600, marginBottom: compact ? "3px" : 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {isRace ? "Carrera" : "Meta"} {e.priority}{compact ? "" : ` · ${e.name}`}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 600, marginTop: "2px" }}>{value}</div>
    </div>
  );
}