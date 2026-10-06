import { ATHLETE_TZ, dayOfWeekLocal, weekRangeLocal } from "@/lib/tz";
import Link from "next/link";
import { WorkoutMiniChart } from "./WorkoutMiniChart";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const TYPE_LABELS: Record<string, string> = {
  gym: "Gym",
  z2: "Z2",
  hiit_genuino: "HIIT",
  ronnestad_30_15: "Rønnestad 30/15",
  z2_sprints: "Z2 + sprints",
  billat: "Billat",
  rst: "RST",
  sweet_spot: "Sweet spot",
  umbral: "Umbral",
  billat_30_30: "Billat",
  ftp_test: "Test FTP (20min)",
  ftp_test_8min: "Test FTP (8min)",
  ftp_test_5min: "Test FTP (5min)",
  test_20min: "Test FTP (20min)",
  test_8min: "Test FTP (8min)",
  test_5min: "Test FTP (5min)",
};

const STATUS_DOT: Record<string, string> = {
  PLANNED: "var(--text-dim)",
  SUGGESTED: "var(--teal-dim, #2A5C56)",
  EDITED: "var(--amber)",
  APPROVED: "var(--teal)",
  SENT_TO_INTERVALS: "var(--teal)",
  COMPLETED: "var(--text-muted)",
};

interface WeekWorkout {
  id: string;
  date: string;
  workoutLibraryKey: string;
  status: string;
  estimatedTss: number | null;
  blocksJson: { type: string; durationSec: number; targetWatts: number }[];
}

export function WeekList({
  workouts,
  weekStartISO,
  todayISO,
}: {
  workouts: WeekWorkout[];
  /** Inicio (domingo 00:00 local) de la semana a mostrar. Por defecto, la actual. */
  weekStartISO?: string;
  /** Instante "ahora" (del servidor) para resaltar el día de hoy solo si está en esta semana. */
  todayISO?: string;
}) {
  const now = todayISO ? new Date(todayISO) : new Date();
  const weekStart = weekStartISO ? new Date(weekStartISO) : weekRangeLocal(now).start;
  const isCurrentWeek = weekRangeLocal(now).start.getTime() === weekStart.getTime();
  const todayDow = isCurrentWeek ? dayOfWeekLocal(now) : -1;

  const byDay = new Map<number, WeekWorkout>();
  for (const w of workouts) {
    byDay.set(dayOfWeekLocal(new Date(w.date)), w);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {DAY_NAMES.map((name, dayOfWeek) => {
        const workout = byDay.get(dayOfWeek);
        const dayDate = new Date(weekStart.getTime() + dayOfWeek * 24 * 60 * 60 * 1000);
        const isToday = dayOfWeek === todayDow;
        const totalMin = workout ? Math.round(workout.blocksJson.reduce((s, b) => s + b.durationSec, 0) / 60) : 0;

        const row = (
          <div
            key={dayOfWeek}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: `1px solid ${isToday ? "var(--teal)" : "var(--border)"}`,
              background: isToday ? "rgba(79,209,197,.05)" : "transparent",
            }}
          >
            <div style={{ width: "72px", flexShrink: 0 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-dim)", textTransform: "uppercase" }}>
                {name.slice(0, 3)}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--text-muted)" }}>
                {dayDate.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: ATHLETE_TZ })}
              </div>
            </div>

            {workout ? (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <span
                      style={{ width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0, background: STATUS_DOT[workout.status] ?? "var(--text-dim)" }}
                    />
                    <span style={{ fontSize: "12.5px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {TYPE_LABELS[workout.workoutLibraryKey] ?? workout.workoutLibraryKey}
                    </span>
                  </div>
                  <WorkoutMiniChart blocks={workout.blocksJson} />
                </div>
                <div style={{ flexShrink: 0, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  <div style={{ fontSize: "12px", color: "var(--text)" }}>{totalMin}min</div>
                  {workout.estimatedTss ? (
                    <div style={{ fontSize: "10.5px", color: "var(--text-dim)" }}>{Math.round(workout.estimatedTss)} TSS</div>
                  ) : null}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, fontSize: "12px", color: "var(--text-dim)" }}>—</div>
            )}
          </div>
        );
        return workout ? (
          <Link key={dayOfWeek} href={`/workouts/${workout.id}`} className="row-link" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            {row}
          </Link>
        ) : (
          row
        );
      })}
    </div>
  );
}
