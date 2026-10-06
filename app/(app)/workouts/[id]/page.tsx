import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { PendingLink } from "@/components/PendingLink";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ATHLETE_TZ } from "@/lib/tz";
import { approveWorkout, sendWorkoutToIntervals } from "@/lib/workout-actions";
import { getExecutionTips } from "@/lib/training-engine/execution-tips";
import { WorkoutDetailChart } from "@/components/WorkoutDetailChart";

type Block = { type: string; durationSec: number; targetWatts: number };

const TYPE_LABELS: Record<string, string> = {
  gym: "Gimnasio",
  z2: "Z2 / Base aeróbica",
  hiit_genuino: "HIIT genuino",
  ronnestad_30_15: "Rønnestad 30/15",
  z2_sprints: "Z2 con sprints",
  billat_30_30: "Billat 30-30",
  rst: "RST",
  sweet_spot: "Sweet spot",
  umbral: "Umbral",
  ftp_test: "Test de FTP (20 min)",
  ftp_test_8min: "Test de FTP (8 min)",
  ftp_test_5min: "Test de FTP (5 min)",
};
const BLOCK_LABELS: Record<string, string> = {
  warmup_z1: "Calentamiento Z1",
  warmup_z2: "Calentamiento Z2",
  warmup_activation: "Activación (umbral)",
  warmup_recovery: "Recuperación",
  warmup_blowout: "Calentamiento (apertura)",
  interval: "Intervalo",
  recovery: "Recuperación",
  z2: "Z2",
  z2_fill: "Relleno Z2",
  cooldown_z2: "Vuelta a la calma Z2",
  cooldown_z1: "Vuelta a la calma Z1",
  gym: "Gimnasio",
  test_20min: "Test 20 min",
  test_8min: "Test 8 min",
  test_5min: "Test 5 min",
};
const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planificada",
  SUGGESTED: "Sugerida",
  EDITED: "Editada",
  APPROVED: "Aprobada",
  SENT_TO_INTERVALS: "Enviada a Intervals",
  COMPLETED: "Completada",
};

function fmt(sec: number): string {
  if (sec < 120) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

interface Row { label: string; count: number; parts: { type: string; durationSec: number; targetWatts: number }[] }

/** Agrupa pares repetidos (intervalo + recuperación) en una sola fila "N × (…)". */
function groupBlocks(blocks: Block[]): Row[] {
  const same = (a: Block, b: Block) => a.type === b.type && a.durationSec === b.durationSec && a.targetWatts === b.targetWatts;
  const rows: Row[] = [];
  let i = 0;
  while (i < blocks.length) {
    const a = blocks[i];
    const b = blocks[i + 1];
    if (b && (a.type === "interval" || a.type === "warmup_activation") && (b.type === "recovery" || b.type === "warmup_recovery")) {
      let n = 1;
      while (blocks[i + 2 * n] && blocks[i + 2 * n + 1] && same(blocks[i + 2 * n], a) && same(blocks[i + 2 * n + 1], b)) n++;
      if (n >= 2) {
        rows.push({ label: "", count: n, parts: [a, b] });
        i += 2 * n;
        continue;
      }
    }
    let n = 1;
    while (blocks[i + n] && same(blocks[i + n], a)) n++;
    rows.push({ label: BLOCK_LABELS[a.type] ?? a.type, count: n, parts: [a] });
    i += n;
  }
  return rows;
}

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const [workout, user] = await Promise.all([
    prisma.generatedWorkout.findUnique({ where: { id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { ftp: true, pvo2maxWatts: true } }),
  ]);
  if (!workout || workout.athleteId !== session.user.id) notFound();

  const blocks = workout.blocksJson as unknown as Block[];
  const ftp = user?.ftp ?? null;
  const totalSec = blocks.reduce((s, b) => s + b.durationSec, 0);
  const rows = groupBlocks(blocks);
  const rationaleItems = (workout.rationale ?? "").split(" · ").filter(Boolean);
  const tips = getExecutionTips(workout.workoutLibraryKey);
  const pct = (w: number) => (ftp ? `${Math.round((w / ftp) * 100)}%` : "—");
  const dateLabel = new Date(workout.date).toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", timeZone: ATHLETE_TZ,
  });

  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "16px" } as const;
  const h = { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "14px" } as const;
  const stat = (label: string, value: string) => (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: "10.5px", color: "var(--text-dim)", textTransform: "uppercase" }}>{label}</div>
    </div>
  );

  return (
    <div className="page-container-narrow">
      <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: "12px", textDecoration: "none" }}>← Volver</Link>

      <div style={{ margin: "14px 0 20px" }}>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "capitalize" }}>{dateLabel}</div>
        <h1 style={{ fontSize: "22px", fontWeight: 600, margin: "4px 0" }}>{TYPE_LABELS[workout.workoutLibraryKey] ?? workout.workoutLibraryKey}</h1>
        <span style={{ fontSize: "11px", color: "var(--teal)", border: "1px solid var(--border)", borderRadius: "999px", padding: "2px 10px" }}>
          {STATUS_LABELS[workout.status] ?? workout.status}
        </span>
      </div>

      <div style={card}>
        <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", marginBottom: "18px" }}>
          {stat("Duración", fmt(totalSec))}
          {stat("TSS", `${Math.round(workout.estimatedTss ?? 0)}`)}
          {stat("kJ", `${Math.round(workout.estimatedKj ?? 0)}`)}
          {stat("Carbos", `${Math.round(workout.suggestedCarbsG ?? 0)} g`)}
          {workout.suggestedCarbsGPerHour ? stat("Carbos/h", `${Math.round(workout.suggestedCarbsGPerHour)} g`) : null}
        </div>
        {workout.workoutLibraryKey !== "gym" && <WorkoutDetailChart blocks={blocks} ftp={ftp} />}
        {workout.requiresMultipleCarbSources && (
          <div style={{ fontSize: "11.5px", color: "var(--amber)", marginTop: "12px" }}>
            Por encima de 60 g/h conviene combinar glucosa y fructosa (más de una fuente de carbohidratos).
          </div>
        )}
      </div>

      {workout.workoutLibraryKey !== "gym" && (
        <div style={card}>
          <div style={h}>Estructura</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "8px 16px", fontSize: "13px" }}>
            <div style={{ color: "var(--text-dim)", fontSize: "10.5px", textTransform: "uppercase" }}>Fase</div>
            <div style={{ color: "var(--text-dim)", fontSize: "10.5px", textTransform: "uppercase", textAlign: "right" }}>Duración</div>
            <div style={{ color: "var(--text-dim)", fontSize: "10.5px", textTransform: "uppercase", textAlign: "right" }}>Potencia</div>
            {rows.map((r, i) =>
              r.parts.length === 2 ? (
                [0, 1].map((k) => (
                  <RowCells
                    key={`${i}-${k}`}
                    label={k === 0 ? `${r.count} × ${BLOCK_LABELS[r.parts[0].type] ?? r.parts[0].type}` : `   ${BLOCK_LABELS[r.parts[1].type] ?? r.parts[1].type}`}
                    dur={fmt(r.parts[k].durationSec)}
                    power={`${r.parts[k].targetWatts} W · ${pct(r.parts[k].targetWatts)}`}
                    strong={k === 0}
                  />
                ))
              ) : (
                <RowCells
                  key={i}
                  label={r.count > 1 ? `${r.count} × ${r.label}` : r.label}
                  dur={fmt(r.parts[0].durationSec)}
                  power={`${r.parts[0].targetWatts} W · ${pct(r.parts[0].targetWatts)}`}
                />
              )
            )}
          </div>
          <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: "12px" }}>
            Porcentajes sobre tu FTP{ftp ? ` (${ftp} W)` : ""}.
            {user?.pvo2maxWatts ? ` Los intervalos de HIIT usan tu potencia en VO2max (${user.pvo2maxWatts} W).` : ""}
          </div>
        </div>
      )}

      {rationaleItems.length > 0 && (
        <div style={card}>
          <div style={h}>Por qué esta sesión</div>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6 }}>
            {rationaleItems.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}

      <div style={card}>
        <div style={h}>Cómo ejecutarla</div>
        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6 }}>
          {tips.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <PendingLink href={`/chat?workoutId=${workout.id}`} style={{ color: "var(--teal)", fontSize: "13px", textDecoration: "none", marginRight: "8px" }}>
          Pedir ajustes en el chat →
        </PendingLink>
        {(workout.status === "PLANNED" || workout.status === "SUGGESTED") && (
          <ActionForm action={approveWorkout} success="Sesión aprobada">
            <input type="hidden" name="workoutId" value={workout.id} />
            <SubmitButton style={{ background: "var(--teal)", color: "#0A1310", border: "none", borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Aprobar</SubmitButton>
          </ActionForm>
        )}
        {(workout.status === "APPROVED" || workout.status === "EDITED") && (
          <ActionForm action={sendWorkoutToIntervals} success="Sesión enviada a Intervals">
            <input type="hidden" name="workoutId" value={workout.id} />
            <SubmitButton style={{ background: "var(--teal)", color: "#0A1310", border: "none", borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Enviar a Intervals</SubmitButton>
          </ActionForm>
        )}
        {workout.status === "SENT_TO_INTERVALS" && <span style={{ color: "var(--teal)", fontSize: "13px" }}>✓ Enviado a Intervals</span>}
      </div>
    </div>
  );
}

function RowCells({ label, dur, power, strong }: { label: string; dur: string; power: string; strong?: boolean }) {
  return (
    <>
      <div style={{ whiteSpace: "pre", fontWeight: strong ? 600 : 400 }}>{label}</div>
      <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "12px" }}>{dur}</div>
      <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "12px" }}>{power}</div>
    </>
  );
}
