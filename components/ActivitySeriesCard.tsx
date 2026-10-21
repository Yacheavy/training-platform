import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { ensureActivitySeries, type PedalDynamics } from "@/lib/activity-series";
import { ActivityChart } from "./ActivityChart";

const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "16px" } as const;
const h = { fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px" } as const;

const f1 = (v: number | null) => (v == null ? "–" : v.toFixed(1).replace(".", ","));
const pair = (l: number | null, r: number | null) => (l == null && r == null ? "–" : `${f1(l)} / ${f1(r)}`);

/** Dinámica de pedaleo (solo si el archivo la trae): descriptiva, sin decir qué cadencia es «mejor». */
function DynamicsView({ d }: { d: PedalDynamics }) {
  const stats: [string, string][] = [
    ["Balance izq./der.", d.balanceLeft != null ? `${f1(d.balanceLeft)} / ${f1(100 - d.balanceLeft)} %` : "–"],
    ["Eficacia del torque (I / D)", `${pair(d.teLeft, d.teRight)} %`],
    ["Suavidad del pedaleo (I / D)", `${pair(d.psLeft, d.psRight)} %`],
  ].filter(([, v]) => v !== "–" && v !== "– %") as [string, string][];
  const score = (b: PedalDynamics["byCadence"][number]) => {
    const v = [b.teLeft, b.teRight, b.psLeft, b.psRight].filter((x): x is number => x != null);
    return v.length ? v.reduce((a, c) => a + c, 0) / v.length : null;
  };
  const rows = d.byCadence;
  const best = rows.filter((r) => r.seconds >= 300 && score(r) != null).sort((a, b) => score(b)! - score(a)!)[0];
  return (
    <div style={card}>
      <div style={h}>Dinámica de pedaleo</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px", marginBottom: rows.length > 1 ? "16px" : 0 }}>
        {stats.map(([label, value]) => (
          <div key={label}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "17px", fontWeight: 600 }}>{value}</div>
            <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: "2px" }}>{label}</div>
          </div>
        ))}
      </div>
      {rows.length > 1 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ color: "var(--text-dim)", textAlign: "left" }}>
                {["Cadencia", "Tiempo", "Potencia", "Torque I / D", "Suavidad I / D", "Balance I"].map((c) => <th key={c} style={{ padding: "4px 8px 6px 0", fontWeight: 500, whiteSpace: "nowrap" }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} style={{ borderTop: "1px solid var(--border)", color: r === best ? "var(--teal)" : undefined }}>
                  <td style={{ padding: "6px 8px 6px 0", whiteSpace: "nowrap" }}>{r.label}</td>
                  <td style={{ padding: "6px 8px 6px 0", whiteSpace: "nowrap" }}>{Math.round(r.seconds / 60)} min</td>
                  <td style={{ padding: "6px 8px 6px 0" }}>{r.avgW != null ? `${Math.round(r.avgW)} W` : "–"}</td>
                  <td style={{ padding: "6px 8px 6px 0", whiteSpace: "nowrap" }}>{pair(r.teLeft, r.teRight)}</td>
                  <td style={{ padding: "6px 8px 6px 0", whiteSpace: "nowrap" }}>{pair(r.psLeft, r.psRight)}</td>
                  <td style={{ padding: "6px 8px 6px 0" }}>{r.balanceLeft != null ? `${f1(r.balanceLeft)} %` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "12px", lineHeight: 1.5 }}>
        Son promedios mientras pedaleás, por rango de cadencia{best ? "; en color, el rango con mayor torque y suavidad entre los de 5 min o más" : ""}. Es una descripción de cómo pedaleaste: no hay evidencia sólida de que un valor «óptimo» de estas métricas implique mejor rendimiento o eficiencia, y cambian según la marca del medidor y la potencia del tramo.
      </div>
    </div>
  );
}

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
    <>
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
    {series.dynamics && <DynamicsView d={series.dynamics} />}
    </>
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
