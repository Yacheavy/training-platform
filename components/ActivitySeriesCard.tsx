import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { ensureActivitySeries } from "@/lib/activity-series";
import { ActivityChart } from "./ActivityChart";

const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "16px" } as const;
const h = { fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px" } as const;

async function Inner({ activityId, athleteId }: { activityId: string; athleteId: string }) {
  let series = null;
  try {
    series = await ensureActivitySeries(activityId);
  } catch (e) {
    console.error("Series de la salida: error", activityId, e);
    return (
      <div style={card}>
        <div style={h}>Gráfico de la salida</div>
        <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>No pude traer los datos de la salida desde Intervals. Probá de nuevo en un rato.</div>
      </div>
    );
  }
  if (!series) return null;
  const user = await prisma.user.findUnique({ where: { id: athleteId }, select: { ftp: true } });
  return (
    <div style={card}>
      <div style={h}>Gráfico de la salida</div>
      <ActivityChart
        stepSec={series.stepSec}
        power={series.power}
        hr={series.hr}
        cadence={series.cadence}
        speed={series.speed}
        altitude={series.altitude}
        ftp={user?.ftp ?? null}
      />
    </div>
  );
}

/** Gráfico interactivo de la salida; los datos se cargan aparte para no demorar el resto de la página. */
export function ActivitySeriesCard({ activityId, athleteId }: { activityId: string; athleteId: string }) {
  return (
    <Suspense fallback={<div style={card}><div style={h}>Gráfico de la salida</div><div style={{ fontSize: "12.5px", color: "var(--text-dim)" }}>Cargando datos de la salida…</div></div>}>
      <Inner activityId={activityId} athleteId={athleteId} />
    </Suspense>
  );
}
