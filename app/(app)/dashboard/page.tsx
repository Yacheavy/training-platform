import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";
import { ActivityIcon } from "@/components/ActivityIcon";
import { STIMULUS_LABELS } from "@/lib/labels";
import { ATHLETE_TZ, dayKeyDate } from "@/lib/tz";
import { syncIfStale } from "@/lib/intervals-sync";
import { syncNow } from "@/lib/sync-actions";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { approveWorkout, sendWorkoutToIntervals } from "@/lib/workout-actions";
import { LoadChart } from "@/components/LoadChart";
import {
  getDashboardData,
  getTodayWorkout,
  getLoadHistory,
  getPlanWorkouts,
  getHrvRhrHistory,
  getAvailabilityHistory,
  getUpcomingBlocks,
} from "@/lib/dashboard-data";
import { AvailabilityRing } from "@/components/AvailabilityRing";
import { PlanNavigator } from "@/components/PlanNavigator";
import { HrvRhrChart } from "@/components/HrvRhrChart";
import { AvailabilityHistoryChart } from "@/components/AvailabilityHistoryChart";
import { PhaseTimeline } from "@/components/PhaseTimeline";
import { calculateAvailability } from "@/lib/training-engine/availability";
import { CheckinForm } from "@/components/CheckinForm";
import { prisma } from "@/lib/prisma";

const WARN_KEYWORDS = ["⚠", "bajando", "Ya alcanzaste", "RED", "AMBER"];

function ageLabel(d: Date | null): string {
  if (!d) return "";
  const days = Math.round((dayKeyDate(new Date()).getTime() - d.getTime()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "(ayer)";
  return `(hace ${days} d)`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await syncIfStale(session.user.id);
  const data = await getDashboardData(session.user.id);
  const todayWorkout = await getTodayWorkout(session.user.id);
  const loadHistory = await getLoadHistory(session.user.id);
  const planWorkouts = await getPlanWorkouts(session.user.id);
  const availability = await calculateAvailability(session.user.id);
  const todayStart = dayKeyDate(new Date());
  const existingCheckin = await prisma.dailyCheckin.findUnique({ where: { athleteId_date: { athleteId: session.user.id, date: todayStart } } });
  const hrvRhrHistory = await getHrvRhrHistory(session.user.id);
  const availabilityHistory = await getAvailabilityHistory(session.user.id);
  const upcomingBlocks = await getUpcomingBlocks(session.user.id);

  const hrvDeltaPct =
    data.hrvToday != null && data.hrvAvg7d != null && data.hrvAvg7d > 0
      ? Math.round(((data.hrvToday - data.hrvAvg7d) / data.hrvAvg7d) * 1000) / 10
      : null;

  let originalSuggestion: string | null = null;
  if (todayWorkout?.rationale) {
    const match = todayWorkout.rationale.match(/sugiere (\w+)/);
    if (match) originalSuggestion = match[1];
  }
  const wasAdjusted = originalSuggestion != null && originalSuggestion !== todayWorkout?.workoutLibraryKey;

  const rationaleItems = todayWorkout?.rationale
    ? todayWorkout.rationale.split(" · ").map((text) => ({
        text,
        warn: WARN_KEYWORDS.some((kw) => text.includes(kw)),
      }))
    : [];

  return (
    <div className="page-container">
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.01em" }}>
            Hola, {session.user.name?.split(" ")[0]}
          </h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "12.5px", color: "var(--text-muted)", marginTop: "6px" }}>
            Último wellness: {data.lastWellnessDate ? new Date(data.lastWellnessDate).toLocaleDateString("es-AR") : "sin datos"}
          </div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "14px 18px" }}>
          <AvailabilityRing status={availability.status} signalsTriggered={availability.signalsTriggered} reasons={availability.reasons} />
        </div>
      </div>

      <div
        className="grid-stats"
        style={{
          marginBottom: "16px",
        }}
      >
        <StatCard label="CTL · Fitness" value={data.ctl?.toFixed(1) ?? "—"} desc="Carga crónica: promedio de 42 días de TSS (Coggan)" />
        <StatCard label="ATL · Fatiga" value={data.atl?.toFixed(1) ?? "—"} desc="Carga aguda: promedio de 7 días de TSS" />
        <StatCard
          label="TSB · Forma"
          value={data.tsb != null ? (data.tsb > 0 ? `+${data.tsb}` : `${data.tsb}`) : "—"}
          desc="CTL menos ATL — positivo es fresco, negativo es fatigado"
          accent={data.tsb != null ? (data.tsb < -25 ? "red" : data.tsb > 5 ? "teal" : undefined) : undefined}
        />
        <StatCard
          label={`HRV ${ageLabel(data.hrvDate)}`}
          value={data.hrvToday?.toFixed(0) ?? "—"}
          sub={hrvDeltaPct != null ? `${hrvDeltaPct > 0 ? "↑" : "↓"} ${Math.abs(hrvDeltaPct)}% vs 7d` : undefined}
          desc="Variabilidad cardíaca — se compara contra tu propia media de 7 días"
        />
        <StatCard label={`FC reposo ${ageLabel(data.restingHrDate)}`} value={data.restingHr?.toFixed(0) ?? "—"} desc="Pulsaciones al despertar, tendencia de fatiga acumulada" />
        <StatCard label={`Sueño ${ageLabel(data.sleepDate)}`} value={data.sleepHours != null ? `${data.sleepHours.toFixed(1)}h` : "—"} desc="Horas dormidas la última noche" />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "4px" }}>
          Plan de entrenamiento
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "14px" }}>
          Navegá semana a semana con las flechas (o deslizando en el celular)
        </div>
        <PlanNavigator workouts={planWorkouts} nowISO={new Date().toISOString()} />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "4px" }}>
          Periodización — próximos bloques
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "16px" }}>
          Objetivo activo y bloques configurados hacia adelante
        </div>
        <PhaseTimeline blocks={upcomingBlocks} />
      </div>

      {availabilityHistory.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "4px" }}>
            Historial de disponibilidad — 30 días
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "10px" }}>
            Score combinado de HRV vs. tu media móvil + TSB, día a día
          </div>
          <AvailabilityHistoryChart data={availabilityHistory} />
        </div>
      )}

      <div className="grid-2col" style={{ marginBottom: "16px" }}>
        {loadHistory.length > 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px" }}>
            <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "4px" }}>
              Carga de entrenamiento — 8 semanas
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "10px" }}>
              CTL (fitness), ATL (fatiga) y TSB (forma) calculados por Intervals.icu
            </div>
            <LoadChart data={loadHistory} />
          </div>
        )}

        {hrvRhrHistory.length > 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px" }}>
            <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "4px" }}>
              HRV vs. FC reposo
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "10px" }}>
              Últimos 7 días
            </div>
            <HrvRhrChart data={hrvRhrHistory} />
          </div>
        )}
      </div>

      <div className="grid-2col-b" style={{ marginBottom: "16px" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "4px" }}>
            Check-in de hoy
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "16px" }}>
            Escala tipo Hooper-Mackinnon — el estrés es el ítem que más pesa según tu perfil
          </div>
          <CheckinForm existing={existingCheckin} />
        </div>

        {todayWorkout && (
          <div
            style={{
              background: "linear-gradient(135deg, var(--surface), var(--surface-2))",
              border: `1px solid ${wasAdjusted ? "var(--amber)" : "var(--teal)"}`,
              borderRadius: "14px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>
                Sesión de hoy
              </div>
              {wasAdjusted && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: "var(--amber)",
                    background: "rgba(232,163,61,.15)",
                    border: "1px solid var(--amber)",
                    padding: "3px 9px",
                    borderRadius: "6px",
                  }}
                >
                  ⚠ Ajustado por check-in
                </span>
              )}
            </div>

            {wasAdjusted ? (
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--text-dim)", textDecoration: "line-through" }}>
                  {originalSuggestion}
                </span>
                <span style={{ color: "var(--text-dim)" }}>→</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 600, color: "var(--text)" }}>
                  {todayWorkout.workoutLibraryKey}
                </span>
              </div>
            ) : (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 600, marginBottom: "4px" }}>
                {todayWorkout.workoutLibraryKey}
              </div>
            )}

            <div style={{ display: "flex", gap: "20px", marginTop: "12px", marginBottom: "16px" }}>
              <MiniStat label="TSS" value={`${Math.round(todayWorkout.estimatedTss ?? 0)}`} />
              <MiniStat label="kJ" value={`${Math.round(todayWorkout.estimatedKj ?? 0)}`} />
              <MiniStat label="Carbos" value={`${todayWorkout.suggestedCarbsG ?? 0}g`} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px", marginBottom: "16px", flex: 1 }}>
              {rationaleItems.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "flex-start",
                    fontSize: "11.5px",
                    color: "var(--text-muted)",
                    padding: "9px 10px",
                    background: "rgba(0,0,0,.15)",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    lineHeight: 1.4,
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      marginTop: "5px",
                      flexShrink: 0,
                      background: item.warn ? "var(--amber)" : "var(--teal)",
                    }}
                  />
                  {item.text}
                </div>
              ))}
            </div>

            <a
              href={`/workouts/${todayWorkout.id}`}
              style={{ color: "var(--teal)", fontSize: "12px", display: "inline-block", marginBottom: "8px", marginRight: "16px", textDecoration: "none" }}
            >
              Ver detalle completo →
            </a>
            <a
              href={`/chat?workoutId=${todayWorkout.id}`}
              style={{ color: "var(--teal)", fontSize: "12px", display: "inline-block", marginBottom: "14px", textDecoration: "none" }}
            >
              Pedir ajustes a este entrenamiento →
            </a>
            <div style={{ display: "flex", gap: "10px" }}>
              {todayWorkout.status === "SUGGESTED" && (
                <ActionForm action={approveWorkout} success="Sesión aprobada">
                  <input type="hidden" name="workoutId" value={todayWorkout.id} />
                  <ActionButton primary>Aprobar</ActionButton>
                </ActionForm>
              )}
              {(todayWorkout.status === "APPROVED" || todayWorkout.status === "EDITED") && (
                <ActionForm action={sendWorkoutToIntervals} success="Sesión enviada a Intervals">
                  <input type="hidden" name="workoutId" value={todayWorkout.id} />
                  <ActionButton primary>Enviar a Intervals</ActionButton>
                </ActionForm>
              )}
              {todayWorkout.status === "SENT_TO_INTERVALS" && (
                <span style={{ color: "var(--teal)", fontSize: "13px" }}>✓ Enviado a Intervals</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px" }}>
        <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "14px" }}>
          Últimas actividades
          <ActionForm action={syncNow} success="Datos actualizados desde Intervals" style={{ display: "inline", float: "right" }}>
            <button type="submit" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", cursor: "pointer" }}>
              Sincronizar
            </button>
          </ActionForm>
        </div>
        {data.recentActivities.length === 0 && (
          <div style={{ fontSize: "12.5px", color: "var(--text-dim)" }}>Todavía no hay actividades sincronizadas.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {data.recentActivities.map((a) => {
            const mins = Math.round(a.durationSec / 60);
            const dur = mins >= 60 ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}` : `${mins} min`;
            const chips: string[] = [];
            if (a.normalizedPower) chips.push(`${Math.round(a.normalizedPower)} W NP`);
            else if (a.avgPower) chips.push(`${Math.round(a.avgPower)} W`);
            if (a.avgHr) chips.push(`${Math.round(a.avgHr)} lpm`);
            if (a.distanceM) chips.push(`${(a.distanceM / 1000).toFixed(1)} km`);
            return (
              <Link key={a.id} href={`/activities/${a.id}`} className="activity-card" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface-2, transparent)" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(79,209,197,.1)", color: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ActivityIcon type={a.type} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "13.5px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{a.name ?? a.type}</span>
                      {a.type === "Ride" && (
                        <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--teal)", border: "1px solid var(--border)", borderRadius: "999px", padding: "1px 8px", whiteSpace: "nowrap" }}>
                          {STIMULUS_LABELS[a.stimulus] ?? a.stimulus}
                        </span>
                      )}
                      {a.deviationFlag !== "NONE" && (
                        <span style={{ fontSize: "10px", color: "var(--amber)", whiteSpace: "nowrap" }}>
                          {a.deviationFlag === "HARDER_THAN_PLANNED" ? "▲ más duro que el plan" : "▼ más suave que el plan"}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-dim)", marginTop: "3px" }}>
                      {new Date(a.date).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: ATHLETE_TZ })}
                      {chips.length > 0 && <span> · {chips.join(" · ")}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, fontFamily: "var(--font-mono)" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>{a.tss ? Math.round(a.tss) : "—"}<span style={{ fontSize: "10px", color: "var(--text-dim)", marginLeft: "3px" }}>TSS</span></div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{dur}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  desc,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  desc?: string;
  accent?: "red" | "teal";
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px" }}>
      <div style={{ fontSize: "10.5px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "22px",
          fontWeight: 600,
          color: accent === "red" ? "var(--red)" : accent === "teal" ? "var(--teal)" : "var(--text)",
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: "3px" }}>{sub}</div>}
      {desc && <div style={{ fontSize: "9.5px", color: "var(--text-dim)", marginTop: "6px", lineHeight: 1.3 }}>{desc}</div>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", color: "var(--text-dim)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 600, marginTop: "2px" }}>{value}</div>
    </div>
  );
}

function ActionButton({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <SubmitButton
      pendingText="Procesando…"
      style={{
        background: primary ? "var(--teal)" : "transparent",
        color: primary ? "#0A1310" : "var(--text-muted)",
        border: primary ? "none" : "1px solid var(--border)",
        borderRadius: "8px",
        padding: "9px 16px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </SubmitButton>
  );
}
