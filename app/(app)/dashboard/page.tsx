import { intensityOf } from "@/lib/training-engine/variants";
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
import { approveAndSendWorkout, sendWorkoutToIntervals } from "@/lib/workout-actions";
import { LoadChart } from "@/components/LoadChart";
import {
  getDashboardData,
  getTodayWorkout,
  getLoadHistory,
  getPlanWorkouts,
  getAvailabilityHistory,
  getUpcomingBlocks,
} from "@/lib/dashboard-data";
import { AvailabilityRing } from "@/components/AvailabilityRing";
import { ChatQuota } from "@/components/ChatQuota";
import { getChatUsage } from "@/lib/chat/usage";
import { Sparkline } from "@/components/Sparkline";
import { FirstTimeTip } from "@/components/FirstTimeTip";
import { ConnectIntervalsModal } from "@/components/ConnectIntervalsModal";
import { getAccessData } from "@/lib/access-data";
import { connectIntervals, postponeIntervalsPrompt } from "@/lib/access-actions";
import { cookies } from "next/headers";
import { PlanNavigator } from "@/components/PlanNavigator";
import { HrvRhrChart } from "@/components/HrvRhrChart";
import { IntensityChart } from "@/components/IntensityChart";
import { PlanVsActualChart } from "@/components/PlanVsActualChart";
import { getHrvBandData, getWeeklyIntensity, getPlanVsActual } from "@/lib/analytics";
import { loadAutoregulation } from "@/lib/autoregulation-data";
import { VARIANTS } from "@/lib/training-engine/variants";
import { AvailabilityHistoryChart } from "@/components/AvailabilityHistoryChart";
import { PhaseTimeline } from "@/components/PhaseTimeline";
import { calculateAvailability } from "@/lib/training-engine/availability";
import { CheckinForm } from "@/components/CheckinForm";
import { decideReadinessAdjustment } from "@/lib/readiness-actions";
import { proposeReadinessAdjustment } from "@/lib/training-engine/readiness-adjust";
import { Card, Section } from "@/components/Card";
import { PendingLink } from "@/components/PendingLink";
import { WorkoutDetailChart } from "@/components/WorkoutDetailChart";
import { summarizeRationale, fmtShort } from "@/lib/session-summary";
import { calculateTss } from "@/lib/training-engine/tss";
import { isOffBike } from "@/lib/training-engine/off-bike";
import { prisma } from "@/lib/prisma";
import { getPendingNutrition } from "@/lib/nutrition-data";
import { applyPlannedNutrition, skipActivityNutrition } from "@/lib/nutrition-actions";


function ageLabel(d: Date | null): string {
  if (!d) return "";
  const days = Math.round((dayKeyDate(new Date()).getTime() - d.getTime()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "(ayer)";
  return `(hace ${days} d)`;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ intervals?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await syncIfStale(session.user.id);
  const access = await getAccessData(session.user.id);
  const needsIntervals = !access.intervals.connected && !access.intervals.usingLegacyEnv;
  const postponed = (await cookies()).get("ivl_later")?.value === "1";
  const showIntervalsModal = needsIntervals && (!postponed || sp.intervals === "invalid" || sp.intervals === "rejected");
  const data = await getDashboardData(session.user.id);
  const todayWorkout = await getTodayWorkout(session.user.id);
  const loadHistory = await getLoadHistory(session.user.id);
  const planWorkouts = await getPlanWorkouts(session.user.id);
  const availability = await calculateAvailability(session.user.id);
  const chatUsage = await getChatUsage(session.user.id);
  const todayStart = dayKeyDate(new Date());
  const existingCheckin = await prisma.dailyCheckin.findUnique({ where: { athleteId_date: { athleteId: session.user.id, date: todayStart } } });
  const [hrvBand, intensity, planVsActual] = await Promise.all([
    getHrvBandData(session.user.id, 30),
    getWeeklyIntensity(session.user.id, 10),
    getPlanVsActual(session.user.id, 10),
  ]);
  const autoreg = await loadAutoregulation(session.user.id).catch(() => null);
  const last4 = intensity.slice(-5, -1); // 4 semanas completas
  const last4Total = last4.reduce((t, w) => t + w.totalH, 0);
  const lowPct = last4Total > 0 ? Math.round((last4.reduce((t, w) => t + w.lowH, 0) / last4Total) * 100) : null;
  const doneWeeks = planVsActual.slice(0, -1).filter((w) => w.compliancePct != null).slice(-4);
  const avgCompliance = doneWeeks.length ? Math.round(doneWeeks.reduce((t, w) => t + (w.compliancePct ?? 0), 0) / doneWeeks.length) : null;
  const availabilityHistory = await getAvailabilityHistory(session.user.id);
  const upcomingBlocks = await getUpcomingBlocks(session.user.id);
  const pendingNutrition = await getPendingNutrition(session.user.id).catch(() => []);

  // Puesta en marcha guiada: solo alumnos (el entrenador no la necesita)
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, ftp: true, onboardingSubmittedAt: true, onboardingReviewedAt: true } });
  const [tplDays, goalCount] = me?.role === "COACH" ? [0, 0] : await Promise.all([
    prisma.trainingTemplateSlot.count({ where: { athleteId: session.user.id, stimulusType: "cycling" } }),
    prisma.athleteGoal.count({ where: { athleteId: session.user.id } }),
  ]);
  const showSetup = me != null && me.role !== "COACH" && !me.onboardingSubmittedAt && !needsIntervals;
  const setupItems: [string, boolean][] = [
    ["FTP cargado", !!me?.ftp],
    ["Semana tipo configurada", tplDays > 0],
    ["Objetivo cargado", goalCount > 0],
    ["Enviado a tu coach para revisar", false],
  ];
  const reviewNote =
    me?.onboardingSubmittedAt && !me.onboardingReviewedAt
      ? "Tu configuración está en revisión: tu coach la va a mirar y puede corregirla."
      : me?.onboardingReviewedAt && Date.now() - me.onboardingReviewedAt.getTime() < 7 * 86400000
        ? "✓ Tu coach revisó tu configuración."
        : null;

  // Mismo criterio que el semáforo (no un número distinto con el mismo nombre): media de 7 días contra tu línea base (o los 6 días previos si todavía no hay base)
  const hrvTrend =
    availability.hrvDeltaPct != null
      ? `${availability.hrvDeltaPct > 0 ? "↑" : "↓"} ${Math.abs(Math.round(availability.hrvDeltaPct * 10) / 10).toString().replace(".", ",")}% ${availability.hrvMethod === "baseline" ? "media 7 d vs tu base" : "hoy vs 6 días previos"}`
      : undefined;
  const rhrTrend =
    availability.restingHrDeltaAbs != null
      ? `${availability.restingHrDeltaAbs > 0 ? "↑" : "↓"} ${Math.abs(Math.round(availability.restingHrDeltaAbs * 10) / 10).toString().replace(".", ",")} lpm ${availability.restingHrMethod === "baseline" ? "media 7 d vs tu base" : "hoy vs 6 días previos"}`
      : undefined;
  const hrvAlert = availability.signalsTriggered.includes("hrv");
  const rhrAlert = availability.signalsTriggered.includes("resting_hr");

  let originalSuggestion: string | null = null;
  if (todayWorkout?.rationale) {
    const match = todayWorkout.rationale.match(/sugiere (\w+)/);
    if (match) originalSuggestion = match[1];
  }
  const wasAdjusted = originalSuggestion != null && originalSuggestion !== todayWorkout?.workoutLibraryKey;

  const todayBlocks = (todayWorkout?.blocksJson ?? []) as unknown as { type: string; durationSec: number; targetWatts: number }[];
  const todaySec = todayBlocks.reduce((t, b) => t + b.durationSec, 0);
  const userFtp = (await prisma.user.findUnique({ where: { id: session.user.id }, select: { ftp: true } }))?.ftp ?? null;
  const todayOffBike = todayWorkout ? isOffBike(todayWorkout.workoutLibraryKey) : false;
  // TSS calculado con la potencia normalizada estándar (como Intervals), no el valor guardado con la fórmula anterior
  const todayTss = userFtp && todayWorkout && !todayOffBike ? calculateTss(todayBlocks, userFtp) : Math.round(todayWorkout?.estimatedTss ?? 0);
  const todayDone = todayWorkout?.status === "COMPLETED";
  const todayActivity = todayDone && todayWorkout
    ? await prisma.activity.findFirst({ where: { generatedWorkoutId: todayWorkout.id }, select: { id: true } })
    : null;
  const summary = summarizeRationale(todayWorkout?.rationale, (k) => STIMULUS_LABELS[k] ?? k);

  const adjustment =
    todayWorkout && todayWorkout.status !== "COMPLETED" && availability.status !== "GREEN" && !(todayWorkout.rationale ?? "").includes(`[CHECKIN:${availability.status}:`)
      ? proposeReadinessAdjustment(availability.status, todayWorkout.workoutLibraryKey, todayWorkout.blocksJson as unknown as { type: string; durationSec: number; targetWatts: number }[], (await prisma.user.findUnique({ where: { id: session.user.id }, select: { ftp: true } }))?.ftp ?? 0)
      : null;

  const sessionLabel = (k: string) => STIMULUS_LABELS[k] ?? k;
  const checkinSummary = existingCheckin
    ? [
        ["Sueño", existingCheckin.sleepQuality],
        ["Fatiga", existingCheckin.fatigue],
        ["Estrés", existingCheckin.stress],
        ["Dolor", existingCheckin.muscleSoreness],
        ["Ánimo", existingCheckin.mood],
      ]
    : null;

  const recentActivitiesCard = (
    <Card
      title="Últimas actividades"
      subtitle="Tocá una para ver su resumen."
      action={
        <ActionForm action={syncNow} success="Datos actualizados desde Intervals">
          <SubmitButton pendingText="Sincronizando…" style={{ background: "transparent", border: "1px solid var(--border-strong)", color: "var(--text-muted)", borderRadius: "8px", padding: "5px 12px", fontSize: "12px" }}>
            Sincronizar
          </SubmitButton>
        </ActionForm>
      }
    >
      {data.recentActivities.length === 0 && <div style={{ fontSize: "12.5px", color: "var(--text-dim)" }}>Todavía no hay actividades sincronizadas.</div>}
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
                        {sessionLabel(a.stimulus)}
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
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>
                    {a.tss ? Math.round(a.tss) : "—"}
                    <span style={{ fontSize: "10px", color: "var(--text-dim)", marginLeft: "3px" }}>TSS</span>
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{dur}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );

  return (
    <div className="page-container">
      {showIntervalsModal && (
        <ConnectIntervalsModal
          name={session.user.name?.split(" ")[0] ?? ""}
          error={sp.intervals === "invalid" || sp.intervals === "rejected" ? sp.intervals : undefined}
          connectAction={connectIntervals}
          laterAction={postponeIntervalsPrompt}
        />
      )}
      {showSetup && (
        <div className="dash-card" style={{ marginBottom: "16px", borderColor: "var(--teal)" }}>
          <h3 className="dash-card-title">Primeros pasos: poné en marcha tu entrenamiento</h3>
          <ul style={{ listStyle: "none", margin: "10px 0 14px", padding: 0, display: "grid", gap: "6px", fontSize: "13.5px" }}>
            {setupItems.map(([t, ok]) => (
              <li key={t} style={{ display: "flex", gap: "9px", alignItems: "center", color: ok ? "var(--text-muted)" : "var(--text)" }}>
                <span aria-hidden style={{ width: "18px", height: "18px", borderRadius: "50%", border: `1.5px solid ${ok ? "var(--teal)" : "var(--border-strong, #3a4656)"}`, background: ok ? "var(--teal)" : "transparent", color: "#08201C", fontSize: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{ok ? "✓" : ""}</span>
                {t}
              </li>
            ))}
          </ul>
          <Link href="/bienvenida" className="btn btn-primary">{tplDays > 0 || goalCount > 0 || me?.ftp ? "Seguir con la configuración" : "Empezar (3 minutos)"}</Link>
        </div>
      )}
      {!showSetup && reviewNote && (
        <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "14px" }}>{reviewNote}</div>
      )}
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Hola, {session.user.name?.split(" ")[0]}</h1>
          <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "6px" }}>
            {data.hrvDate ? `Último dato de recuperación: ${ageLabel(data.hrvDate).replace(/[()]/g, "")}` : "Todavía no hay datos de recuperación"}
          </div>
        </div>
      </div>

      <AvailabilityRing status={availability.status} score={availability.score} alertReasons={availability.alertReasons} chips={availability.chips} insufficient={availability.insufficient} sources={availability.sources} ageDays={availability.wellnessAgeDays} attention={!!availability.acute.message || availability.chips.some((c) => c.state === "watch")} />
      <FirstTimeTip id="semaforo" title="Cómo leer tu disponibilidad" linkText="¿Cómo leer el semáforo?">
        El número y el color resumen cómo llegás hoy, mirando tu HRV, tu FC en reposo, tu check-in y tu forma (TSB). <b>Verde:</b> hacé la sesión como está. <b>Ámbar:</b> con cuidado; si el cuerpo no responde, bajá la intensidad. <b>Rojo:</b> priorizá recuperar. Cada casilla muestra qué señal pesa, y una sola señal aislada no lo pone en rojo.
      </FirstTimeTip>
      {availability.acute.message && (
        <div className="dash-card" style={{ marginBottom: "14px", borderColor: "var(--amber)" }}>
          <h3 className="dash-card-title">Prestá atención</h3>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5, marginTop: "8px" }}>{availability.acute.message}</div>
          {todayWorkout && intensityOf(todayWorkout.workoutLibraryKey) >= 2 && (
            <div style={{ fontSize: "13px", color: "var(--text)", lineHeight: 1.5, marginTop: "8px" }}>Hoy tenés una sesión de calidad. Si en la entrada en calor la FC viene alta o las piernas pesadas, pedí una versión más suave desde «Pedir ajustes» en la sesión.</div>
          )}
          <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "8px" }}>Aviso con criterio práctico del sistema (no de un ensayo): no cambia el semáforo. Un día aislado puede deberse al sueño, al alcohol o al reloj.</div>
        </div>
      )}

      <Section title="Cómo estás">
        <div className="metric-strip">
          <StatCard label="Fitness (CTL)" value={data.ctl?.toFixed(1) ?? "—"} spark={loadHistory.slice(-28).map((d) => d.ctl)} color="#6FA8DC" />
          <StatCard label="Fatiga (ATL)" value={data.atl?.toFixed(1) ?? "—"} spark={loadHistory.slice(-28).map((d) => d.atl)} color="#B58CE0" />
          <StatCard
            label="Forma (TSB)"
            value={data.tsb != null ? (data.tsb > 0 ? `+${data.tsb}` : `${data.tsb}`) : "—"}
            sub={data.tsb == null ? undefined : data.tsb < -25 ? "Muy fatigado" : data.tsb > 5 ? "Fresco" : "Entrenable"}
            spark={loadHistory.slice(-28).map((d) => d.tsb)}
            color={data.tsb != null && data.tsb < -25 ? "#E5636A" : "#4FD1C5"}
            accent={data.tsb != null ? (data.tsb < -25 ? "red" : data.tsb > 5 ? "teal" : undefined) : undefined}
          />
          <StatCard
            label={`HRV ${ageLabel(data.hrvDate)}`}
            value={data.hrvToday?.toFixed(0) ?? "—"}
            sub={hrvTrend}
            accent={hrvAlert ? "amber" : undefined}
            spark={hrvBand.points.slice(-28).map((p) => p.hrv)}
            color="#4FD1C5"
          />
          <StatCard label={`FC reposo ${ageLabel(data.restingHrDate)}`} value={data.restingHr?.toFixed(0) ?? "—"} sub={rhrTrend} accent={rhrAlert ? "amber" : undefined} spark={hrvBand.points.slice(-28).map((p) => p.restingHr)} color="#E8A33D" />
          <StatCard label={`Sueño ${ageLabel(data.sleepDate)}`} value={data.sleepHours != null ? `${data.sleepHours.toFixed(1)}h` : "—"} sub={data.sleepTrend ?? undefined} />
        </div>
      </Section>

      <Section title="Hoy">
        {pendingNutrition.length > 0 && (
          <div className="dash-card" style={{ marginBottom: "14px", borderColor: "var(--teal)" }}>
            <h3 className="dash-card-title">Completá la nutrición de tu última salida</h3>
            <div style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "6px 0 12px", lineHeight: 1.5 }}>
              Registrar CHO y líquido le permite a la IA detectar si la alimentación está afectando tu rendimiento.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {pendingNutrition.map((p) => (
                <div key={p.id} style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
                  <div style={{ fontSize: "13px", minWidth: 0 }}>
                    <b>{p.name ?? "Salida"}</b>
                    <span style={{ color: "var(--text-dim)" }}>
                      {" "}· {new Date(p.dateKey + "T12:00:00Z").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} · {Math.round(p.durationSec / 60)} min
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {p.plannedG > 0 && (
                      <ActionForm action={applyPlannedNutrition} success="Registrado: consumiste lo planificado">
                        <input type="hidden" name="activityId" value={p.id} />
                        <ActionButton primary>Consumí lo planificado ({p.plannedG} g)</ActionButton>
                      </ActionForm>
                    )}
                    <Link href={`/activities/${p.id}`} className="btn" style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-strong)", borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>Cargar detalle</Link>
                    <ActionForm action={skipActivityNutrition} success="Omitida">
                      <input type="hidden" name="activityId" value={p.id} />
                      <ActionButton>Omitir</ActionButton>
                    </ActionForm>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {adjustment && todayWorkout && (
          <div className="dash-card" style={{ marginBottom: "14px", borderColor: availability.status === "RED" ? "var(--red, #E5636A)" : "var(--amber)" }}>
            <h3 className="dash-card-title">Ajuste sugerido por tu estado de hoy ({availability.status === "RED" ? "semáforo rojo" : "semáforo ámbar"})</h3>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5, margin: "8px 0 12px" }}>
              {availability.reasons.join(" · ")}
              <div style={{ color: "var(--text)", marginTop: "8px", fontWeight: 600 }}>{adjustment.label}</div>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <ActionForm action={decideReadinessAdjustment} success="Sesión ajustada">
                <input type="hidden" name="workoutId" value={todayWorkout.id} />
                <input type="hidden" name="decision" value="apply" />
                <ActionButton primary>Aplicar ajuste</ActionButton>
              </ActionForm>
              <ActionForm action={decideReadinessAdjustment} success="Se mantiene la sesión">
                <input type="hidden" name="workoutId" value={todayWorkout.id} />
                <input type="hidden" name="decision" value="keep" />
                <ActionButton>Mantener como está</ActionButton>
              </ActionForm>
            </div>
          </div>
        )}
        <FirstTimeTip id="checkin" title="Para qué sirve el check-in" linkText="¿Para qué el check-in?">
          Contá en 10 segundos cómo dormiste y cómo te sentís (de 1 a 7). Con eso el semáforo se ajusta a vos y no solo a lo que mide el reloj. Conviene hacerlo cada mañana.
        </FirstTimeTip>
        <div className="dash-row today">
          <Card
            title="Check-in de hoy"
            subtitle={existingCheckin ? "Ya lo completaste. Si algo cambió, podés actualizarlo." : "Cinco preguntas rápidas. Con esto la app ajusta la sesión de hoy si venís cansado."}
          >
            {checkinSummary ? (
              <details className="checkin">
                <summary>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                    {checkinSummary.map(([label, v]) => (
                      <span key={label as string} style={{ fontSize: "12px", background: "var(--surface-3)", borderRadius: "8px", padding: "5px 10px" }}>
                        {label} <strong style={{ fontFamily: "var(--font-mono)", color: "var(--teal)" }}>{v ?? "—"}</strong>
                      </span>
                    ))}
                  </div>
                  <span style={{ color: "var(--teal)", fontSize: "12.5px", fontWeight: 600 }}>Editar check-in</span>
                </summary>
                <div style={{ marginTop: "16px" }}>
                  <CheckinForm existing={existingCheckin} />
                </div>
              </details>
            ) : (
              <CheckinForm existing={existingCheckin} />
            )}
          </Card>

          {todayWorkout ? (
            <div
              className="dash-card"
              style={{
                background: "linear-gradient(135deg, var(--surface), var(--surface-2))",
                borderColor: wasAdjusted ? "var(--amber)" : "var(--teal)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                <h3 className="dash-card-title">Sesión de hoy</h3>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {wasAdjusted && <span className="pill pill-amber">Ajustada por tu check-in</span>}
                  {todayWorkout.environment === "indoor" && <span className="pill pill-amber">Rodillo</span>}
                  {todayDone
                    ? <span className="pill pill-teal">✓ Realizada</span>
                    : todayWorkout.status === "SENT_TO_INTERVALS"
                      ? <span className="pill pill-teal">✓ En Intervals</span>
                      : <span className="pill">Sin enviar</span>}
                </div>
              </div>

              {wasAdjusted ? (
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", color: "var(--text-dim)", textDecoration: "line-through" }}>{sessionLabel(originalSuggestion!)}</span>
                  <span style={{ color: "var(--text-dim)" }}>→</span>
                  <span style={{ fontSize: "21px", fontWeight: 600 }}>{sessionLabel(todayWorkout.workoutLibraryKey)}</span>
                </div>
              ) : (
                <div style={{ fontSize: "21px", fontWeight: 600 }}>{sessionLabel(todayWorkout.workoutLibraryKey)}</div>
              )}
              {summary.evidence && (
                <div style={{ fontSize: "11.5px", color: "var(--text-dim)", marginTop: "3px" }}>Evidencia: {summary.evidence}</div>
              )}

              <div className="today-stats">
                <MiniStat label="Duración" value={fmtShort(Math.round(todaySec / 60))} />
                {!todayOffBike && <MiniStat label="TSS" value={`${todayTss}`} />}
                {!todayOffBike && <MiniStat label="kJ" value={`${Math.round(todayWorkout.estimatedKj ?? 0)}`} />}
                {!todayOffBike && <MiniStat label="Carbos" value={todayWorkout.suggestedCarbsG ? `${Math.round(todayWorkout.suggestedCarbsG)} g` : "—"} />}
              </div>

              {!todayOffBike && <div style={{ marginBottom: "16px" }}><WorkoutDetailChart blocks={todayBlocks} ftp={userFtp} /></div>}

              {(summary.context || summary.why) && (
                <div className="today-why">
                  {summary.context && <div className="today-why-ctx">{summary.context}</div>}
                  {summary.why && <div>{summary.why}</div>}
                </div>
              )}

              {summary.changes.length > 0 && (
                <ul className="today-changes">
                  {summary.changes.map((c, i) => (
                    <li key={i}>
                      <span className="today-dot" style={{ background: c.warn ? "var(--amber)" : "var(--teal)" }} />
                      {c.text}
                    </li>
                  ))}
                </ul>
              )}

              {summary.detail.length > 0 && (
                <details className="today-more">
                  <summary>Más detalle</summary>
                  <ul>
                    {summary.detail.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </details>
              )}

              <div className="today-actions">
                {!todayDone && (todayWorkout.status === "SUGGESTED" || todayWorkout.status === "PLANNED") && (
                  <ActionForm action={approveAndSendWorkout} success="Sesión aprobada y enviada a Intervals" style={{ display: "contents" }}>
                    <input type="hidden" name="workoutId" value={todayWorkout.id} />
                    <ActionButton primary>Aprobar y enviar</ActionButton>
                  </ActionForm>
                )}
                {!todayDone && (todayWorkout.status === "APPROVED" || todayWorkout.status === "EDITED") && (
                  <ActionForm action={sendWorkoutToIntervals} success="Sesión enviada a Intervals" style={{ display: "contents" }}>
                    <input type="hidden" name="workoutId" value={todayWorkout.id} />
                    <ActionButton primary>Enviar a Intervals</ActionButton>
                  </ActionForm>
                )}
                {todayDone && todayActivity && (
                  <Link href={`/activities/${todayActivity.id}`} className="btn btn-primary">Ver cómo te fue (gráfico y análisis)</Link>
                )}
                <Link href={`/workouts/${todayWorkout.id}`} className="btn btn-outline">{todayDone ? "Ver la sesión planificada" : "Ver sesión y cambiarla"}</Link>
                {!todayDone && <PendingLink href={`/chat?workoutId=${todayWorkout.id}`} className="btn btn-outline accent">Pedir ajustes (IA)</PendingLink>}
              </div>
              {!todayDone && !chatUsage.isCoach && (
                <div style={{ marginTop: "12px" }}>
                  <ChatQuota used={chatUsage.sentToday} limit={chatUsage.limit} compact />
                </div>
              )}
            </div>
          ) : (
            <Card title="Sesión de hoy" subtitle="No hay una sesión planificada para hoy.">
              <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Es un día de descanso en tu plan, o todavía no generaste el plan. Podés revisar la semana más abajo o regenerar el plan desde{" "}
                <Link href="/settings" style={{ color: "var(--teal)", textDecoration: "none" }}>Ajustes</Link>.
              </div>
            </Card>
          )}
        </div>
      </Section>

      <Section title="Tu plan">
        <Card title="Plan de entrenamiento" subtitle="Navegá semana a semana con las flechas, o deslizando en el celular.">
          <PlanNavigator workouts={planWorkouts} nowISO={new Date().toISOString()} />
        </Card>
        <div style={{ height: "16px" }} />
        <Card title="Periodización" subtitle="Objetivo activo y bloques configurados hacia adelante.">
          <PhaseTimeline blocks={upcomingBlocks} />
        </Card>
      </Section>

      <Section title="Recuperación">
        <div className="dash-row two">
          <Card
            title="HRV y FC de reposo, 30 días"
            subtitle={
              hrvBand.band
                ? `La franja es tu rango habitual (${Math.round(hrvBand.band.low)}–${Math.round(hrvBand.band.high)} ms, según tus últimos ${hrvBand.band.days} días). Si la línea gruesa se mantiene por debajo varios días, es señal de fatiga.`
                : "Todavía no hay 4 semanas de HRV para calcular tu rango habitual; mientras tanto se compara contra la media de los días previos."
            }
          >
            <HrvRhrChart points={hrvBand.points} band={hrvBand.band} />
          </Card>
          {availabilityHistory.length > 0 && (
            <Card title="Disponibilidad, 30 días" subtitle="El mismo cálculo del semáforo de hoy, aplicado día a día con los datos que había ese día. Los puntos huecos son días sin check-in.">
              <AvailabilityHistoryChart data={availabilityHistory} />
            </Card>
          )}
        </div>
      </Section>

      <Section title="Carga y cumplimiento">
        <div className="dash-row two" style={{ marginBottom: "16px" }}>
          {loadHistory.length > 0 && (
            <Card title="Carga de entrenamiento, 8 semanas" subtitle="CTL (fitness), ATL (fatiga) y TSB (forma), calculados por Intervals.icu.">
              <LoadChart data={loadHistory} />
            </Card>
          )}
          <Card
            title="Distribución de intensidad"
            subtitle={
              lowPct != null
                ? `En las últimas 4 semanas el ${lowPct}% del tiempo fue en zona baja. La referencia para entrenamiento polarizado es cerca de 80%.`
                : "Horas por semana en zona baja, media y alta."
            }
          >
            <IntensityChart data={intensity} />
          </Card>
        </div>
        {autoreg && (autoreg.guard || Object.values(autoreg.execution).some((e) => e.n >= 2)) && (
          <div style={{ marginBottom: "16px" }}>
            <Card
              title="Ajuste automático del plan"
              subtitle="El plan se corrige solo con lo que realmente hiciste (al regenerarlo). Son reglas de práctica, no resultados de ensayos."
            >
              <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.7 }}>
                {autoreg.guard && <li>{autoreg.guard.reason}</li>}
                {Object.entries(autoreg.execution)
                  .filter(([, e]) => e.n >= 2)
                  .map(([k, e]) => (
                    <li key={k}>
                      <b style={{ color: "var(--text)" }}>{VARIANTS[k]?.label ?? k}</b>: {e.adjust === 1 ? "sube un escalón" : e.adjust === -1 ? "repite el escalón anterior" : "según calendario"} ({e.n} sesiones). {e.adjust !== 0 ? e.reason : ""}
                    </li>
                  ))}
              </ul>
            </Card>
          </div>
        )}
        <Card
          title="Plan vs. realizado"
          subtitle={
            avgCompliance != null
              ? `Cumplimiento de las últimas semanas completas: ${avgCompliance}% de la carga planificada (TSS). Las semanas sin plan completo no se cuentan.`
              : "Carga planificada contra la que hiciste, semana a semana. El cumplimiento aparece cuando hay semanas completas con plan."
          }
        >
          <PlanVsActualChart data={planVsActual} />
        </Card>
      </Section>

      <Section title="Actividad reciente">{recentActivitiesCard}</Section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  spark,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "red" | "teal" | "amber";
  spark?: (number | null)[];
  color?: string;
}) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: accent === "red" ? "var(--red)" : accent === "teal" ? "var(--teal)" : accent === "amber" ? "var(--amber)" : "var(--text)" }}>
        {value}
      </div>
      {sub && <div className="metric-sub">{sub}</div>}
      {spark && spark.filter((v) => v != null).length > 1 && (
        <div className="metric-spark">
          <Sparkline values={spark} color={color} id={label.replace(/\W/g, "")} />
        </div>
      )}
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
        color: primary ? "#0A1310" : "var(--text)",
        border: primary ? "none" : "1px solid var(--border-strong)",
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
