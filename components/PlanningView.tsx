import { TemplateEditor } from "@/components/TemplateEditor";
import { GoalsCard } from "@/components/GoalsCard";
import { SeasonCard } from "@/components/SeasonCard";
import { PlanStyleCard } from "@/components/ThresholdsCard";
import Link from "next/link";
import { getSeasonState } from "@/lib/season-data";
import { applySeason, deleteFutureBlock } from "@/lib/season-actions";
import { dateKeyLocal } from "@/lib/tz";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { regeneratePlan } from "@/lib/plan-actions";
import { getSettingsData } from "@/lib/settings-data";
import { saveTemplate, saveThresholds, addGoal, deleteGoal } from "@/lib/settings-actions";
import { coachAddGoal, coachDeleteGoal, coachSaveTemplate, coachSaveThresholds, coachRegeneratePlan, coachApplySeason, coachDeleteFutureBlock } from "@/lib/coach-actions";

const OBJ_LABEL: Record<string, string> = { base: "Base", umbral: "Umbral", vo2max: "VO2max", tapering: "Puesta a punto" };
const DAY = 86400000;
const keyMs = (k: string) => new Date(k + "T00:00:00Z").getTime();
const diffDays = (a: string, b: string) => Math.round((keyMs(b) - keyMs(a)) / DAY);
const fmtKey = (k: string) => new Date(k + "T00:00:00Z").toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export type PlanningSearch = { regenerated?: string; kept?: string; resent?: string; failed?: string; warnings?: string; skipped?: string; blockerr?: string };

/**
 * Pantalla de planificación. La usa cada alumno sobre sí mismo y el entrenador sobre un alumno (`coach`):
 * en ese caso las acciones llevan el id del alumno y se vuelven a autorizar en el servidor.
 */
export async function PlanningView({ athleteId, sp, coach }: { athleteId: string; sp: PlanningSearch; coach?: { studentName: string } }) {
  const { template, goals, thresholds, user } = await getSettingsData(athleteId);
  const season = await getSeasonState(athleteId);
  const today = season.todayKey;
  const current = season.existing.find((b) => b.startKey <= today && today < b.endKey) ?? null;
  const next = season.existing.find((b) => b.startKey > today) ?? null;
  const proposedNext = !next && season.proposal.blocks.length ? season.proposal.blocks[0] : null;
  const activeObjective = current?.objective ?? null;

  const cardStyle = { background: "var(--grad-card)", border: "1px solid rgba(255,255,255,.06)", boxShadow: "0 1px 0 rgba(255,255,255,.03) inset, 0 8px 24px -12px rgba(0,0,0,.5)", borderRadius: "var(--radius)", padding: "22px", marginBottom: "20px" };
  const btnStyle = { background: "linear-gradient(135deg, #5BDDD1, #3DB8AD)", color: "#08201C", border: "none", borderRadius: "12px", padding: "10px 18px", boxShadow: "0 6px 16px -8px rgba(79,209,197,.6)", fontSize: "13px", fontWeight: 600, cursor: "pointer" };
  
  const warnings: string[] = [];
  if (!user?.ftp) warnings.push(coach ? "Este alumno todavía no cargó su FTP: sin eso no se pueden generar sesiones (lo carga él en Ajustes)." : "Falta tu FTP: sin eso no se pueden generar sesiones.");
  if (user?.ftp && !user?.pvo2maxWatts) warnings.push(coach ? "No tiene cargada su potencia en VO2max: los intervalos de VO2max usan un % del FTP." : "No cargaste tu potencia en VO2max: los intervalos de VO2max usan un % del FTP.");
  if (!season.goal) warnings.push(coach ? "No hay un objetivo con fecha: cargá uno abajo y la app arma la temporada." : "No hay un objetivo con fecha: cargá uno abajo y la app arma la temporada.");

  // Acciones: las del propio alumno, o las del entrenador con el id del alumno (se vuelven a autorizar en el servidor)
  const act = coach
    ? {
        addGoal: coachAddGoal.bind(null, athleteId),
        deleteGoal: coachDeleteGoal.bind(null, athleteId),
        applySeason: coachApplySeason.bind(null, athleteId),
        deleteBlock: coachDeleteFutureBlock.bind(null, athleteId),
        saveTemplate: coachSaveTemplate.bind(null, athleteId),
        saveThresholds: coachSaveThresholds.bind(null, athleteId),
        regenerate: coachRegeneratePlan.bind(null, athleteId),
      }
    : { addGoal, deleteGoal, applySeason, deleteBlock: deleteFutureBlock, saveTemplate, saveThresholds, regenerate: regeneratePlan };
  const coachUpdated = !coach && user?.coachPlanUpdatedAt && Date.now() - user.coachPlanUpdatedAt.getTime() < 14 * DAY ? user.coachPlanUpdatedAt : null;

  return (
    <div className="page-container-narrow" style={{ minHeight: "100vh", fontFamily: "var(--font-display)" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: "18px" }}>{coach ? `Planificación de ${coach.studentName}` : "Planificación"}</h1>
      {coach && (
        <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "-8px 0 18px", lineHeight: 1.6 }}>
          Estás editando el plan de tu alumno: sus objetivos, la temporada, su semana tipo y su estilo de plan. Las sesiones nuevas llevan la etiqueta «Armado por tu coach» y, cuando regenerás el plan o la temporada, le llega un email. Él también puede ajustar su plan; el último cambio manda.
        </p>
      )}
      {coachUpdated && (
        <div style={{ ...cardStyle, borderColor: "var(--teal-dim)", fontSize: "12.5px", color: "var(--teal)" }}>
          Tu coach actualizó tu planificación el {coachUpdated.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}. Las sesiones nuevas llevan la etiqueta «Armado por tu coach».
        </div>
      )}

      {/* Resumen: dónde estás parado */}
      <div className="metric-strip" style={{ marginBottom: "20px" }}>
        <div className="metric">
          <div className="metric-label" style={{ marginBottom: "6px" }}>Objetivo</div>
          {season.goal ? (
            <>
              <div style={{ fontSize: "17px", fontWeight: 600, letterSpacing: "-0.01em" }}>{season.goal.name}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{fmtKey(season.goal.dateKey)} · faltan {diffDays(today, season.goal.dateKey)} días</div>
            </>
          ) : (
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Sin objetivo con fecha</div>
          )}
        </div>
        <div className="metric">
          <div className="metric-label" style={{ marginBottom: "6px" }}>Bloque actual</div>
          {current ? (
            <>
              <div style={{ fontSize: "17px", fontWeight: 600, letterSpacing: "-0.01em" }}>{OBJ_LABEL[current.objective] ?? current.objective}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                semana {Math.floor(diffDays(current.startKey, today) / 7) + 1} de {Math.ceil(diffDays(current.startKey, current.endKey) / 7)} · hasta {fmtKey(current.endKey)}
              </div>
            </>
          ) : (
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Ninguno en curso</div>
          )}
        </div>
        <div className="metric">
          <div className="metric-label" style={{ marginBottom: "6px" }}>Siguiente fase</div>
          {next ? (
            <>
              <div style={{ fontSize: "17px", fontWeight: 600, letterSpacing: "-0.01em" }}>{OBJ_LABEL[next.objective] ?? next.objective}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>desde {fmtKey(next.startKey)}</div>
            </>
          ) : proposedNext ? (
            <>
              <div style={{ fontSize: "17px", fontWeight: 600, letterSpacing: "-0.01em" }}>{OBJ_LABEL[proposedNext.objective]} <span style={{ fontSize: "11px", color: "#E8A33D", fontWeight: 400 }}>(propuesta)</span></div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>desde {fmtKey(proposedNext.startKey)} · todavía no creada</div>
            </>
          ) : (
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>—</div>
          )}
        </div>
      </div>

      {warnings.length > 0 && (
        <div style={{ ...cardStyle, borderColor: "#6B5A2A", fontSize: "12.5px", color: "#E8A33D" }}>
          {warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
          {!coach && user?.ftp && !user?.pvo2maxWatts && (
            <div style={{ marginTop: "6px" }}>
              <Link href="/settings" style={{ color: "#4FD1C5", textDecoration: "none" }}>Cargarla en Ajustes → Cuenta</Link>
            </div>
          )}
        </div>
      )}

      {/* 1. Objetivos */}
      <GoalsCard
        goals={goals.map((g) => ({
          id: g.id,
          goalType: g.goalType as "EVENT" | "PERFORMANCE",
          name: g.name,
          eventDate: g.eventDate ? g.eventDate.toISOString().slice(0, 10) : null,
          priority: g.priority as "A" | "B" | "C",
          metric: g.metric,
          baselineValue: g.baselineValue,
          targetValue: g.targetValue,
          createdByCoach: g.createdByCoach,
        }))}
        todayKey={dateKeyLocal(new Date())}
        currentFtp={user?.ftp ?? null}
        addAction={act.addGoal}
        deleteAction={act.deleteGoal}
        coachMode={!!coach}
        cardStyle={cardStyle}
      />

      {/* 2. Temporada */}
      <SeasonCard state={season} applyAction={act.applySeason} deleteAction={act.deleteBlock} cardStyle={cardStyle} />

      {/* 3. Semana tipo */}
      {/* Plantilla semanal */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "14px", marginBottom: "6px" }}>Días de entrenamiento</h2>
        <p style={{ fontSize: "11.5px", color: "var(--text-dim)", marginBottom: "14px" }}>
          Elegí qué hacés cada día, cuáles son de calidad (intensidad) y cuánto duran. Se guarda todo junto con un solo botón; después regenerá el plan para aplicarlo.
        </p>
        <TemplateEditor slots={template.map((t) => ({ dayOfWeek: t.dayOfWeek, stimulusType: t.stimulusType, isQualityDay: t.isQualityDay, targetDurationMin: t.targetDurationMin }))} action={act.saveTemplate} />
      </div>

      {/* 4. Estilo del plan */}
      <PlanStyleCard
        thresholds={thresholds ? { weeksBetweenFtpTest: thresholds.weeksBetweenFtpTest, ftpTestProtocol: thresholds.ftpTestProtocol ?? undefined, deloadRatio: thresholds.deloadRatio, vo2Stimulus: thresholds.vo2Stimulus, varietyLevel: thresholds.varietyLevel, bannedStimuli: thresholds.bannedStimuli, periodization: thresholds.periodization, flexibilityEnabled: thresholds.flexibilityEnabled, contrastMode: thresholds.contrastMode } : null}
        action={act.saveThresholds}
        activeObjective={activeObjective}
        cardStyle={cardStyle}
      />

      {/* Aplicar los cambios */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "14px", marginBottom: "6px" }}>Plan de entrenamiento</h2>
        <p style={{ fontSize: "11.5px", color: "var(--text-dim)", marginBottom: "14px" }}>
          Si cambiaste los días de la plantilla, el FTP o la potencia en VO2max, regenerá las sesiones planificadas para que las usen. Se reemplazan todas las sesiones
          desde hoy, también las aprobadas o enviadas (las enviadas se actualizan solas en Intervals). No se tocan las del pasado, las completadas ni las editadas a mano. Si cambiás la potencia, guardá primero y recién después regenerá.
        </p>
        <ActionForm action={act.regenerate} success={null} confirm="Se reemplazan todas las sesiones planificadas desde hoy (no las del pasado, las completadas ni las editadas a mano). ¿Regenerar el plan?">
          <SubmitButton style={btnStyle}>Regenerar plan desde hoy</SubmitButton>
        </ActionForm>
        {sp.regenerated != null && (
          <div style={{ fontSize: "12px", color: "#4FD1C5", marginTop: "10px" }}>
            Listo: {sp.regenerated} sesiones nuevas.{Number(sp.resent) > 0 ? ` ${sp.resent} sesión(es) ya enviadas se actualizaron en Intervals.` : ""}{Number(sp.failed) > 0 ? ` ${sp.failed} no se pudieron reenviar a Intervals: abrilas y tocá «Enviar a Intervals».` : ""}{Number(sp.kept) > 0 ? ` ${sp.kept} sesión(es) editadas a mano se conservaron (usá «Regenerar esta sesión» si querés rehacerlas).` : ""}{sp.warnings ? ` ${sp.warnings} advertencia(s) del validador — avisame.` : ""}
            {Number(sp.skipped) > 0 && <span style={{ color: "#E8A33D" }}> {sp.skipped} día(s) no se pudieron guardar: volvé a regenerar.</span>}
            {sp.blockerr && <span style={{ color: "#E8A33D" }}> No se pudo regenerar: {sp.blockerr}. Volvé a intentar.</span>}
          </div>
        )}
      </div>
    </div>
  );
}
