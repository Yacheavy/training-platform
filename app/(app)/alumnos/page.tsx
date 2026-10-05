import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCoachOverview, type StudentRow } from "@/lib/analytics";

const STATUS = {
  RED: { label: "Baja", color: "var(--red)", order: 0 },
  AMBER: { label: "Moderada", color: "var(--amber)", order: 1 },
  GREEN: { label: "Alta", color: "var(--teal)", order: 3 },
} as const;

function ago(iso: string | null, now: number): string {
  if (!iso) return "nunca";
  const days = Math.floor((now - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

function daysSince(iso: string | null, now: number): number | null {
  return iso ? Math.floor((now - new Date(iso).getTime()) / 86400000) : null;
}

/** Cuánto atención necesita: rojo > ámbar > sin datos recientes > verde. */
function priority(s: StudentRow, now: number): number {
  if (s.status === "RED") return 0;
  if (s.status === "AMBER") return 1;
  const stale = daysSince(s.lastSync, now);
  if (!s.hasIntervals || stale == null || stale >= 3) return 2;
  return 3;
}

export default async function StudentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (me?.role !== "COACH") redirect("/dashboard");

  const rows = await getCoachOverview(session.user.id);
  const now = Date.now();
  const sorted = [...rows].sort((a, b) => priority(a, now) - priority(b, now) || a.name.localeCompare(b.name));
  const count = (st: StudentRow["status"]) => rows.filter((r) => r.status === st).length;
  const noData = rows.filter((r) => !r.hasIntervals || (daysSince(r.lastSync, now) ?? 99) >= 3).length;

  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 18px" } as const;

  return (
    <div className="page-container-narrow">
      <h1 style={{ fontSize: "22px", fontWeight: 600, margin: "0 0 4px" }}>Alumnos</h1>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 18px" }}>
        Cómo está cada alumno hoy, ordenados por quién necesita más atención.
      </p>

      {rows.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "32px 20px" }}>
          <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "6px" }}>Todavía no tenés alumnos</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "14px" }}>Invitalos por email desde Ajustes. Cada uno conecta su propia cuenta de Intervals.</div>
          <Link href="/settings" style={{ color: "var(--teal)", textDecoration: "none", fontSize: "13px", fontWeight: 600 }}>Ir a Ajustes</Link>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
            {[
              { n: count("RED"), label: "con disponibilidad baja", color: "var(--red)" },
              { n: count("AMBER"), label: "moderada", color: "var(--amber)" },
              { n: count("GREEN"), label: "alta", color: "var(--teal)" },
              { n: noData, label: "sin datos recientes", color: "var(--text-dim)" },
            ].map((c) => (
              <div key={c.label} style={{ ...card, padding: "10px 14px", display: "flex", alignItems: "baseline", gap: "8px" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 600, color: c.color }}>{c.n}</span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{c.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {sorted.map((s) => {
              const st = s.status ? STATUS[s.status] : null;
              const syncDays = daysSince(s.lastSync, now);
              const warnings: string[] = [];
              if (!s.hasIntervals) warnings.push("No conectó Intervals todavía");
              else if (syncDays == null || syncDays >= 3) warnings.push(`Sin sincronizar ${syncDays == null ? "nunca" : `hace ${syncDays} días`}`);
              if (s.hasIntervals && s.hrvAgeDays != null && s.hrvAgeDays >= 2) warnings.push(`Último HRV ${ago(new Date(now - s.hrvAgeDays * 86400000).toISOString(), now)}`);
              const compliance = s.weekPlannedToDateTss > 0 ? Math.round((s.weekActualTss / s.weekPlannedToDateTss) * 100) : null;

              return (
                <div key={s.id} style={{ ...card, borderLeft: `3px solid ${st?.color ?? "var(--border)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "baseline" }}>
                    <div>
                      <span style={{ fontSize: "15px", fontWeight: 600 }}>{s.name}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-dim)", marginLeft: "8px" }}>{s.email}</span>
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: st?.color ?? "var(--text-dim)" }}>
                      {st ? `Disponibilidad ${st.label.toLowerCase()}` : "Sin datos para evaluar"}
                    </div>
                  </div>

                  {s.reasons.length > 0 && s.status !== "GREEN" && (
                    <ul style={{ margin: "8px 0 0", paddingLeft: "18px", fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {s.reasons.slice(0, 3).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", marginTop: "14px" }}>
                    {[
                      ["CTL", s.ctl != null ? `${s.ctl}` : "—"],
                      ["TSB", s.tsb != null ? `${s.tsb > 0 ? "+" : ""}${s.tsb}` : "—"],
                      ["Última actividad", ago(s.lastActivity, now)],
                      ["Semana (TSS)", s.weekPlannedToDateTss > 0 ? `${s.weekActualTss} de ${s.weekPlannedToDateTss}${compliance != null ? ` · ${compliance}%` : ""}` : `${s.weekActualTss} · sin plan`],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 600 }}>{value}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {warnings.length > 0 && (
                    <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--amber)" }}>{warnings.join(" · ")}</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <p style={{ fontSize: "11.5px", color: "var(--text-dim)", marginTop: "22px", lineHeight: 1.5 }}>
        Estos datos de salud (HRV, FC de reposo, sueño) son de cada alumno. Antes de invitarlos, avisales qué información vas a ver y para qué, y pedí su consentimiento.
      </p>
    </div>
  );
}
