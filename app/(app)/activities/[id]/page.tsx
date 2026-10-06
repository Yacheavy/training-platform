import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { classifyStimulusType } from "@/lib/training-engine/stimulus-classifier";
import { STIMULUS_LABELS, ZONE_LABELS } from "@/lib/labels";
import { ActivityIcon } from "@/components/ActivityIcon";
import { PendingLink } from "@/components/PendingLink";

const ZONE_COLORS: Record<string, string> = {
  Z1: "#3A4A5C", Z2: "#2A8C82", Z3: "#6BAF5C", SS: "#C9B23A", Z4: "#E8A33D", Z5: "#E5636A", Z6: "#B04A8F", Z7: "#7A4AB0",
};

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const a = await prisma.activity.findUnique({ where: { id }, include: { generatedWorkout: { select: { id: true, workoutLibraryKey: true, estimatedTss: true } } } });
  if (!a || a.athleteId !== session.user.id) notFound();

  const stimulus = classifyStimulusType({ type: a.type, name: a.name, intensityFactor: a.intensityFactor, rawStreamsJson: a.rawStreamsJson });
  const zoneTimes = ((a.rawStreamsJson as { zoneTimes?: { id: string; secs: number }[] } | null)?.zoneTimes ?? []).filter((z) => z.secs > 0);
  const zoneTotal = zoneTimes.reduce((s, z) => s + z.secs, 0);

  const dateLabel = new Date(a.date).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const timeLabel = new Date(a.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "16px" } as const;
  const h = { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "14px" } as const;

  const metrics: [string, string | null][] = [
    ["Duración", fmtDuration(a.durationSec)],
    ["Distancia", a.distanceM ? `${(a.distanceM / 1000).toFixed(1)} km` : null],
    ["TSS", a.tss != null ? `${Math.round(a.tss)}` : null],
    ["Intensidad (IF)", a.intensityFactor != null ? (a.intensityFactor > 3 ? (a.intensityFactor / 100).toFixed(2) : a.intensityFactor.toFixed(2)) : null],
    ["Potencia normalizada", a.normalizedPower ? `${Math.round(a.normalizedPower)} W` : null],
    ["Potencia media", a.avgPower ? `${Math.round(a.avgPower)} W` : null],
    ["Índice de variabilidad", a.variabilityIndex ? a.variabilityIndex.toFixed(2) : null],
    ["FC media", a.avgHr ? `${Math.round(a.avgHr)} lpm` : null],
    ["FC máxima", a.maxHr ? `${Math.round(a.maxHr)} lpm` : null],
    ["Cadencia", a.avgCadence ? `${Math.round(a.avgCadence)} rpm` : null],
    ["Trabajo", a.kilojoules ? `${Math.round(a.kilojoules)} kJ` : null],
    ["Desnivel", a.elevationGainM ? `${Math.round(a.elevationGainM)} m` : null],
    ["Factor de eficiencia", a.efficiencyFactor ? a.efficiencyFactor.toFixed(2) : null],
    ["Desacople Pw:HR", a.decouplingPct != null ? `${a.decouplingPct.toFixed(1)} %` : null],
  ];
  const shown = metrics.filter(([, v]) => v != null) as [string, string][];

  const planned = a.generatedWorkout;
  const diffPct = a.plannedTss && a.tss ? Math.round(((a.tss - a.plannedTss) / a.plannedTss) * 100) : null;

  return (
    <div className="page-container-narrow">
      <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: "12px", textDecoration: "none" }}>← Volver</Link>

      <div style={{ margin: "14px 0 20px", display: "flex", gap: "14px", alignItems: "center" }}>
        <div style={{ width: "46px", height: "46px", borderRadius: "12px", background: "rgba(79,209,197,.1)", color: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ActivityIcon type={a.type} size={24} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "capitalize" }}>{dateLabel} · {timeLabel}</div>
          <h1 style={{ fontSize: "21px", fontWeight: 600, margin: "3px 0" }}>{a.name ?? a.type}</h1>
          {a.type === "Ride" && (
            <span style={{ fontSize: "11px", color: "var(--teal)", border: "1px solid var(--border)", borderRadius: "999px", padding: "2px 10px" }}>
              {STIMULUS_LABELS[stimulus] ?? stimulus}
            </span>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={h}>Resumen</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "16px" }}>
          {shown.map(([label, value]) => (
            <div key={label}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "18px", fontWeight: 600 }}>{value}</div>
              <div style={{ fontSize: "10.5px", color: "var(--text-dim)", textTransform: "uppercase", marginTop: "2px" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {zoneTotal > 0 && (
        <div style={card}>
          <div style={h}>Tiempo por zona</div>
          <div style={{ display: "flex", height: "14px", borderRadius: "7px", overflow: "hidden", marginBottom: "14px" }}>
            {zoneTimes.map((z) => (
              <div key={z.id} title={`${ZONE_LABELS[z.id] ?? z.id}: ${fmtDuration(z.secs)}`} style={{ width: `${(z.secs / zoneTotal) * 100}%`, background: ZONE_COLORS[z.id] ?? "#555" }} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {zoneTimes.map((z) => (
              <div key={z.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: ZONE_COLORS[z.id] ?? "#555", flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{ZONE_LABELS[z.id] ?? z.id}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{fmtDuration(z.secs)} · {Math.round((z.secs / zoneTotal) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(planned || a.plannedTss) && (
        <div style={card}>
          <div style={h}>Plan vs. real</div>
          <div style={{ fontSize: "13px", marginBottom: "6px" }}>
            {planned ? `Sesión planificada: ${STIMULUS_LABELS[planned.workoutLibraryKey] ?? planned.workoutLibraryKey}` : "Sesión planificada"}
            {a.plannedTss ? ` · TSS planeado ${Math.round(a.plannedTss)} vs real ${a.tss != null ? Math.round(a.tss) : "—"}` : ""}
            {diffPct != null ? ` (${diffPct > 0 ? "+" : ""}${diffPct}%)` : ""}
          </div>
          {a.deviationNotes && <div style={{ fontSize: "12px", color: "var(--amber)" }}>{a.deviationNotes}</div>}
          {planned && (
            <Link href={`/workouts/${planned.id}`} style={{ color: "var(--teal)", fontSize: "12px", textDecoration: "none", display: "inline-block", marginTop: "8px" }}>
              Ver la sesión planificada →
            </Link>
          )}
        </div>
      )}

      <PendingLink href={`/chat?activityId=${a.id}`} style={{ color: "var(--teal)", fontSize: "12.5px", textDecoration: "none" }}>
        Analizar esta sesión con el chat →
      </PendingLink>
    </div>
  );
}
