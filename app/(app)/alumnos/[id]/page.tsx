import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { pushGoalsToIntervals } from "@/lib/push-goals";
import { requireCoachOfStudent } from "@/lib/access";
import { calculateAvailability } from "@/lib/training-engine/availability";
import { getPlanVsActual, getHrvBandData } from "@/lib/analytics";
import { getDashboardData, getLoadHistory, getAvailabilityHistory } from "@/lib/dashboard-data";
import { AvailabilityRing } from "@/components/AvailabilityRing";
import { AvailabilityHistoryChart } from "@/components/AvailabilityHistoryChart";
import { Sparkline } from "@/components/Sparkline";
import { PlanVsActualChart } from "@/components/PlanVsActualChart";
import { Card, Section } from "@/components/Card";
import { STIMULUS_LABELS } from "@/lib/labels";
import { dateKeyLocal, dayKeyDate } from "@/lib/tz";
import { getChatUsage } from "@/lib/chat/usage";
import { getNutritionSummary } from "@/lib/nutrition-data";
import { NutritionPatterns } from "@/components/NutritionPatterns";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { coachSendPlanToIntervals } from "@/lib/coach-actions";
import { markOnboardingReviewed } from "@/lib/onboarding-actions";

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
  await pushGoalsToIntervals(id).catch((e) => console.error("Objetivos del alumno a Intervals", e));

  const todayKey = dateKeyLocal(new Date());
  const [availability, data, weeks, upcoming, activities, checkin, chatUsage, nutrition, load, hrvBand, availHistory] = await Promise.all([
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
    getLoadHistory(id),
    getHrvBandData(id, 30),
    getAvailabilityHistory(id),
  ]);
  const days = upcoming.filter((w) => dateKeyLocal(w.date) >= todayKey);

  // Configuración que cargó el alumno (para revisarla y corregirla)
  const [cfgUser, cfgSlots, cfgGoals] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { weight: true, trainingBackground: true, currentStateNote: true, preferences: true, onboardingSubmittedAt: true, onboardingReviewedAt: true } }),
    prisma.trainingTemplateSlot.findMany({ where: { athleteId: id } }),
    prisma.athleteGoal.findMany({ where: { athleteId: id }, orderBy: { eventDate: "asc" }, take: 5 }),
  ]);
  const DAY_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const TYPE_ES: Record<string, string> = { cycling: "Bici", gym: "Gimnasio", flexibility: "Movilidad", rest: "Descanso" };
  const cfgDays = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ d, s: cfgSlots.find((x) => x.dayOfWeek === d) }));
  const needsReview = !!cfgUser?.onboardingSubmittedAt && !cfgUser.onboardingReviewedAt;

  const mins = (b: unknown) => Math.round(((b as { durationSec?: number }[]) ?? []).reduce((s, x) => s + (x.durationSec ?? 0), 0) / 60);
  const l28 = load.slice(-28);
  const metrics: { label: string; value: string; spark?: (number | null)[]; color?: string; sub?: string }[] = [
    { label: "Fitness (CTL)", value: data.ctl?.toFixed(1) ?? "—", spark: l28.map((d) => d.ctl), color: "var(--blue)" },
    { label: "Fatiga (ATL)", value: data.atl?.toFixed(1) ?? "—", spark: l28.map((d) => d.atl), color: "#B58CE0" },
    { label: "Forma (TSB)", value: data.tsb != null ? (data.tsb > 0 ? `+${data.tsb}` : `${data.tsb}`) : "—", spark: l28.map((d) => d.tsb) },
    { label: "HRV", value: data.hrvToday?.toFixed(0) ?? "—", spark: hrvBand.points.slice(-28).map((p) => p.hrv) },
    { label: "FC reposo", value: data.restingHr?.toFixed(0) ?? "—", spark: hrvBand.points.slice(-28).map((p) => p.restingHr), color: "var(--amber)" },
    { label: "Sueño", value: data.sleepHours != null ? `${data.sleepHours.toFixed(1)}h` : "—", sub: data.sleepTrend ?? undefined },
  ];
  const row = { display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" as const, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.05)", fontSize: "13px" };

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <Link href="/settings?tab=alumnos" style={{ color: "var(--teal)", fontSize: "12.5px", textDecoration: "none" }}>← Alumnos</Link>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <Link href={`/alumnos/${id}/calendario`} style={{ border: "1px solid var(--border-strong)", color: "var(--teal)", borderRadius: "12px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>Calendario del alumno</Link>
        <Link href={`/alumnos/${id}/planificacion`} style={{ background: "linear-gradient(135deg, #5BDDD1, #3DB8AD)", color: "#08201C", borderRadius: "12px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>Planificación del alumno →</Link>
        </div>
      </div>
      <h1 className="page-title" style={{ margin: "12px 0 4px" }}>{student.name ?? student.email}</h1>
      <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "20px" }}>
        {student.email} · FTP {student.ftp ?? "—"} W{student.pvo2maxWatts ? ` · PAM ${student.pvo2maxWatts} W` : ""} · {student.intervalsAthleteId ? `Intervals conectado${student.intervalsLastSyncAt ? `, sync ${student.intervalsLastSyncAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}` : ""}` : "sin Intervals"}
      </div>

      {(cfgUser?.onboardingSubmittedAt || cfgSlots.length > 0) && (
        <div className="dash-card" style={{ marginBottom: "16px", borderColor: needsReview ? "var(--amber)" : undefined }}>
          <h3 className="dash-card-title">
            Configuración del alumno {needsReview ? "· para revisar" : cfgUser?.onboardingReviewedAt ? "· revisada" : ""}
          </h3>
          <div style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "6px 0 10px" }}>
            {cfgUser?.onboardingSubmittedAt ? `Enviada el ${cfgUser.onboardingSubmittedAt.toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" })}.` : "El alumno todavía no la envió."} FTP {student.ftp ?? "sin definir"}{cfgUser?.weight ? ` · ${cfgUser.weight} kg` : ""}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: "8px", marginBottom: "10px" }}>
            {cfgDays.map(({ d, s: sl }) => (
              <div key={d} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "7px 9px", fontSize: "12px", opacity: !sl || sl.stimulusType === "rest" ? 0.6 : 1 }}>
                <div style={{ color: "var(--text-dim)" }}>{DAY_ES[d]}</div>
                <div style={{ fontWeight: 600 }}>{TYPE_ES[sl?.stimulusType ?? "rest"] ?? sl?.stimulusType}{sl?.isQualityDay ? " · calidad" : ""}</div>
                {sl?.targetDurationMin ? <div style={{ color: "var(--text-muted)" }}>{sl.targetDurationMin} min</div> : null}
              </div>
            ))}
          </div>
          {cfgGoals.length > 0 && <div style={{ fontSize: "12.5px", marginBottom: "6px" }}><b>Objetivos:</b> {cfgGoals.map((g) => `${g.name}${g.eventDate ? ` (${g.eventDate.toISOString().slice(0, 10)}, ${g.priority})` : ""}`).join(" · ")}</div>}
          {cfgUser?.currentStateNote && <div style={{ fontSize: "12.5px", marginBottom: "6px" }}><b>Lesiones o molestias:</b> {cfgUser.currentStateNote}</div>}
          {cfgUser?.preferences && <div style={{ fontSize: "12.5px", marginBottom: "6px" }}><b>Límites y preferencias:</b> {cfgUser.preferences}</div>}
          {cfgUser?.trainingBackground && <div style={{ fontSize: "12.5px", marginBottom: "6px" }}><b>Experiencia:</b> {cfgUser.trainingBackground}</div>}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginTop: "12px" }}>
            <Link href={`/alumnos/${id}/planificacion`} className="btn btn-outline btn-sm">Corregir semana y objetivos</Link>
            {needsReview && (
              <ActionForm action={markOnboardingReviewed.bind(null, id)} success="Marcada como revisada">
                <SubmitButton className="btn btn-primary btn-sm">Marcar como revisada</SubmitButton>
              </ActionForm>
            )}
          </div>
        </div>
      )}

      <AvailabilityRing status={availability.status} score={availability.score} alertReasons={availability.alertReasons} chips={availability.chips} insufficient={availability.insufficient} sources={availability.sources} ageDays={availability.wellnessAgeDays} />

      <Section title="Cómo está">
        <div className="metric-strip">
          {metrics.map((m) => (
            <div className="metric" key={m.label}>
              <div className="metric-label">{m.label}</div>
              <div className="metric-value">{m.value}</div>
              {m.sub && <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "3px" }}>{m.sub}</div>}
              {m.spark && m.spark.filter((v) => v != null).length > 1 && (
                <div className="metric-spark"><Sparkline values={m.spark} color={m.color} id={`s${m.label.replace(/\W/g, "")}`} /></div>
              )}
            </div>
          ))}
        </div>
        {checkin && (
          <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
            Check-in de hoy (1–7): sueño {checkin.sleepQuality} · fatiga {checkin.fatigue} · estrés {checkin.stress} · dolor {checkin.muscleSoreness} · ánimo {checkin.mood}
            {checkin.freeText ? ` — «${checkin.freeText}»` : ""}
          </div>
        )}
      </Section>

      <Section title="Entrenamiento">
        <div className="dash-row two">
          <Card title="Próximos 7 días" subtitle="Tocá un día para ver la sesión.">
            {days.some((w) => w.status !== "SENT_TO_INTERVALS" && w.status !== "COMPLETED") && (
              <ActionForm action={coachSendPlanToIntervals.bind(null, id)} success="Plan enviado a Intervals" style={{ marginBottom: "12px" }}>
                <SubmitButton className="btn btn-solid" pendingText="Enviando…">Aprobar y enviar a Intervals</SubmitButton>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>Manda al calendario de Intervals de {student.name ?? "el alumno"} las sesiones pendientes de hoy en adelante.</div>
              </ActionForm>
            )}
            {days.length === 0 ? <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Sin sesiones planificadas.</div> : (
              <div>
                {days.map((w) => (
                  <div key={w.id} style={row}>
                    <Link href={`/workouts/${w.id}`} style={{ color: "inherit", textDecoration: "none" }}><strong style={{ textTransform: "capitalize" }}>{fmtDay(w.date, false).replace(".", "")}</strong> · {STIMULUS_LABELS[w.workoutLibraryKey] ?? w.workoutLibraryKey} <span style={{ color: "var(--teal)" }}>›</span></Link>
                    <span style={{ color: "var(--text-muted)" }}>{(w.workoutLibraryKey === "gym" || w.workoutLibraryKey === "flexibility") ? "" : `${mins(w.blocksJson)} min · TSS ${Math.round(w.estimatedTss ?? 0)} · `}{STATUS_ES[w.status] ?? w.status}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Últimas actividades">
            {activities.length === 0 ? <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Sin actividades.</div> : (
              <div>
                {activities.map((a) => (
                  <div key={a.id} style={row}>
                    <span><strong style={{ textTransform: "capitalize" }}>{fmtDay(a.date).replace(".", "")}</strong> · {a.name ?? a.type}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {Math.round(a.durationSec / 60)} min · TSS {a.tss != null ? Math.round(a.tss) : "—"}
                      {a.deviationFlag === "HARDER_THAN_PLANNED" ? " · ▲ más duro que el plan" : a.deviationFlag === "EASIER_THAN_PLANNED" ? " · ▼ más suave que el plan" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </Section>

      <Section title="Tendencias">
        <div className="dash-row two">
          <Card title="Plan vs realizado" subtitle="TSS semanal, últimas semanas.">
            <PlanVsActualChart data={weeks} />
          </Card>
          {availHistory.length > 0 && (
            <Card title="Disponibilidad, 30 días" subtitle="Mismo cálculo del semáforo, día a día.">
              <AvailabilityHistoryChart data={availHistory} />
            </Card>
          )}
        </div>
      </Section>

      <Section title="Nutrición y asistente">
        <div className="dash-row two">
          <Card title="Nutrición durante las sesiones (6 semanas)">
            <NutritionPatterns summary={nutrition} />
          </Card>
          <Card title="Uso del asistente (chat)">
            <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.7 }}>
              Hoy: {chatUsage.sentToday} de {chatUsage.limit} mensajes · {chatUsage.todayTokens.toLocaleString("es-AR")} tokens · US$ {chatUsage.todayCostUsd.toFixed(3)}
              <br />
              Este mes: {chatUsage.monthMessages} respuestas · US$ {chatUsage.monthCostUsd.toFixed(2)}
              {chatUsage.avgCostPerMessageUsd != null ? ` (≈ US$ ${chatUsage.avgCostPerMessageUsd.toFixed(3)} por respuesta)` : ""}
            </div>
          </Card>
        </div>
      </Section>
      <p style={{ fontSize: "11.5px", color: "var(--text-dim)", lineHeight: 1.5 }}>Desde «Planificación del alumno» podés manejar sus objetivos, la temporada, su semana tipo y su estilo de plan. El FTP y las sesiones sueltas los ajusta cada alumno desde su cuenta.</p>
    </div>
  );
}
