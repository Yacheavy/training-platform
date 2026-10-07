import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCoachOfStudent } from "@/lib/access";
import { calculateAvailability } from "@/lib/training-engine/availability";
import { getPlanVsActual } from "@/lib/analytics";
import { getDashboardData } from "@/lib/dashboard-data";
import { STIMULUS_LABELS } from "@/lib/labels";
import { dateKeyLocal, dayKeyDate } from "@/lib/tz";
import { getChatUsage } from "@/lib/chat/usage";
import { getNutritionSummary } from "@/lib/nutrition-data";
import { NutritionPatterns } from "@/components/NutritionPatterns";

const STATUS = {
  RED: { label: "Baja", color: "var(--red)" },
  AMBER: { label: "Moderada", color: "var(--amber)" },
  GREEN: { label: "Alta", color: "var(--teal)" },
} as const;

const STATUS_ES: Record<string, string> = {
  PLANNED: "Planificada", SUGGESTED: "Sugerida", EDITED: "Editada", APPROVED: "Aprobada", SENT_TO_INTERVALS: "Enviada", COMPLETED: "Completada",
};

const fmtDay = (d: Date, utc = true) =>
  d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: utc ? "UTC" : undefined });

/** Vista de solo lectura de un alumno para su entrenador. */
export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const student = await requireCoachOfStudent(id).catch(() => null);
  if (!student) notFound();

  const todayKey = dateKeyLocal(new Date());
  const [availability, data, weeks, upcoming, activities, checkin, chatUsage, nutrition] = await Promise.all([
    calculateAvailability(id),
    getDashboardData(id),
    getPlanVsActual(id, 6),
    prisma.generatedWorkout.findMany({
      where: { athleteId: id, date: { gte: new Date(Date.now() - 24 * 3600 * 1000), lt: new Date(Date.now() + 8 * 24 * 3600 * 1000) } },
      orderBy: { date: "asc" },
    }),
    prisma.activity.findMany({ where: { athleteId: id }, orderBy: { date: "desc" }, take: 8, select: { id: true, date: true, name: true, type: true, tss: true, durationSec: true, deviationFlag: true } }),
    prisma.dailyCheckin.findUnique({ where: { athleteId_date: { athleteId: id, date: dayKeyDate(new Date()) } } }),
    getChatUsage(id),
    getNutritionSummary(id, 42),
  ]);
  const st = STATUS[availability.status];
  const days = upcoming.filter((w) => dateKeyLocal(w.date) >= todayKey);

  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 18px", marginBottom: "14px" } as const;
  const h = { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", margin: "0 0 12px" } as const;
  const mins = (b: unknown) => Math.round(((b as { durationSec?: number }[]) ?? []).reduce((s, x) => s + (x.durationSec ?? 0), 0) / 60);

  return (
    <div className="page-container-narrow">
      <Link href="/settings?tab=alumnos" style={{ color: "var(--teal)", fontSize: "12px", textDecoration: "none" }}>← Alumnos</Link>
      <h1 style={{ fontSize: "22px", fontWeight: 600, margin: "12px 0 2px" }}>{student.name ?? student.email}</h1>
      <div style={{ fontSize: "12px", color: "var(--text-dim)", marginBottom: "16px" }}>
        {student.email} · FTP {student.ftp ?? "—"} W{student.pvo2maxWatts ? ` · PAM ${student.pvo2maxWatts} W` : ""} · {student.intervalsAthleteId ? `Intervals conectado${student.intervalsLastSyncAt ? `, sync ${student.intervalsLastSyncAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}` : ""}` : "sin Intervals"}
      </div>

      <div style={{ ...card, borderLeft: `3px solid ${st.color}` }}>
        <h2 style={h}>Disponibilidad hoy</h2>
        <div style={{ fontSize: "15px", fontWeight: 600, color: st.color }}>{st.label}</div>
        <ul style={{ margin: "8px 0 0", paddingLeft: "18px", fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.5 }}>
          {availability.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "12px", marginTop: "14px", fontFamily: "var(--font-mono)", fontSize: "14px" }}>
          {[["CTL", data.ctl?.toFixed(1)], ["ATL", data.atl?.toFixed(1)], ["TSB", data.tsb?.toString()], ["HRV", data.hrvToday?.toFixed(0)], ["FC reposo", data.restingHr?.toFixed(0)], ["Sueño h", data.sleepHours?.toFixed(1)]].map(([l, v]) => (
            <div key={l as string}><div style={{ fontWeight: 600 }}>{v ?? "—"}</div><div style={{ fontSize: "11px", color: "var(--text-dim)", fontFamily: "inherit" }}>{l}</div></div>
          ))}
        </div>
        {checkin && (
          <div style={{ marginTop: "12px", fontSize: "12.5px", color: "var(--text-muted)" }}>
            Check-in de hoy (1–7): sueño {checkin.sleepQuality} · fatiga {checkin.fatigue} · estrés {checkin.stress} · dolor {checkin.muscleSoreness} · ánimo {checkin.mood}
            {checkin.freeText ? ` — «${checkin.freeText}»` : ""}
          </div>
        )}
      </div>

      <div style={card}>
        <h2 style={h}>Próximos 7 días</h2>
        {days.length === 0 ? <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Sin sesiones planificadas.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
            {days.map((w) => (
              <div key={w.id} style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                <span><strong style={{ textTransform: "capitalize" }}>{fmtDay(w.date, false).replace(".", "")}</strong> · {STIMULUS_LABELS[w.workoutLibraryKey] ?? w.workoutLibraryKey}</span>
                <span style={{ color: "var(--text-muted)" }}>{w.workoutLibraryKey === "gym" ? "" : `${mins(w.blocksJson)} min · TSS ${Math.round(w.estimatedTss ?? 0)} · `}{STATUS_ES[w.status] ?? w.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <h2 style={h}>Últimas actividades</h2>
        {activities.length === 0 ? <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Sin actividades.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
            {activities.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                <span><strong style={{ textTransform: "capitalize" }}>{fmtDay(a.date).replace(".", "")}</strong> · {a.name ?? a.type}</span>
                <span style={{ color: "var(--text-muted)" }}>
                  {Math.round(a.durationSec / 60)} min · TSS {a.tss != null ? Math.round(a.tss) : "—"}
                  {a.deviationFlag === "HARDER_THAN_PLANNED" ? " · ▲ más duro que el plan" : a.deviationFlag === "EASIER_THAN_PLANNED" ? " · ▼ más suave que el plan" : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <h2 style={h}>Plan vs realizado (últimas semanas)</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
          {weeks.map((w) => (
            <div key={w.weekStart} style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
              <span>Semana del {fmtDay(new Date(w.weekStart), false)}{w.isCurrent ? " (actual)" : ""}</span>
              <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {w.actualTss} / {w.plannedTss} TSS{w.compliancePct != null ? ` · ${w.compliancePct}%` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div style={card}>
        <h2 style={h}>Nutrición durante las sesiones (6 semanas)</h2>
        <NutritionPatterns summary={nutrition} />
      </div>
      <div style={card}>
        <h2 style={h}>Uso del asistente (chat)</h2>
        <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6 }}>
          Hoy: {chatUsage.sentToday} de {chatUsage.limit} mensajes · {chatUsage.todayTokens.toLocaleString("es-AR")} tokens · US$ {chatUsage.todayCostUsd.toFixed(3)}
          <br />
          Este mes: {chatUsage.monthMessages} respuestas · US$ {chatUsage.monthCostUsd.toFixed(2)}
          {chatUsage.avgCostPerMessageUsd != null ? ` (≈ US$ ${chatUsage.avgCostPerMessageUsd.toFixed(3)} por respuesta)` : ""}
        </div>
      </div>
      <p style={{ fontSize: "11.5px", color: "var(--text-dim)", lineHeight: 1.5 }}>Vista de solo lectura. Los ajustes de sesiones los hace cada alumno desde su cuenta.</p>
    </div>
  );
}
