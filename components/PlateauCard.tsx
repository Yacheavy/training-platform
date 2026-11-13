import type { PlateauResult } from "@/lib/training-engine/plateau";

const fmt = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

/** Aviso de carga estancada. Solo se muestra con status "flat". Es un indicio, no un diagnóstico (lo dice el pie). */
export function PlateauCard({ p, audience = "athlete" }: { p: PlateauResult; audience?: "athlete" | "coach" }) {
  if (p.status !== "flat" || p.ctlFrom == null || p.ctlTo == null || p.change == null) return null;
  const who = audience === "coach" ? "Su" : "Tu";
  const sign = p.change > 0 ? "+" : p.change < 0 ? "−" : "";
  const max = Math.max(...p.weeklyCtl);
  const min = Math.min(...p.weeklyCtl);
  const span = Math.max(1, max - min);
  const stale = p.ftpStaleWeeks != null && p.ftpStaleWeeks >= p.weeks;
  return (
    <section aria-label="Carga estancada" style={{ marginTop: "16px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-lg)", padding: "16px", background: "var(--grad-card)" }}>
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12h18" /><path d="M7 8l-4 4 4 4" opacity=".0" /><path d="M3 17l5-5 4 3 5-6 4 3" /></svg>
        <h3 style={{ margin: 0, fontSize: "15.5px" }}>{who} carga lleva {p.weeks} semanas sin moverse</h3>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "5px", height: "44px", marginTop: "14px" }} aria-hidden>
        {p.weeklyCtl.map((v, i) => (
          <div key={i} style={{ flex: 1, height: `${18 + ((v - min) / span) * 26}px`, borderRadius: "5px", background: i === p.weeklyCtl.length - 1 ? "var(--blue)" : "var(--blue-dim)" }} />
        ))}
      </div>
      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "10px", lineHeight: 1.5 }}>
        La fitness (CTL) pasó de {fmt(p.ctlFrom)} a {fmt(p.ctlTo)} ({sign}{fmt(Math.abs(p.change))}) en {p.weeks} semanas{p.avgWeeklyTss != null ? `, con unos ${Math.round(p.avgWeeklyTss)} de TSS por semana` : ""}.
        Con una carga que no cambia, la adaptación se frena: para seguir mejorando hace falta subirla de a poco{p.suggestedRamp != null ? ` (probá +${fmt(p.suggestedRamp)} de CTL por semana, dentro de ${audience === "coach" ? "su" : "tu"} límite)` : ""} o cambiar el estímulo.
        {stale ? ` Además el FTP lleva ${p.ftpStaleWeeks} semanas sin actualizarse: un test ayuda a confirmar cómo estás.` : ""}
      </div>
      <div style={{ fontSize: "11.5px", color: "var(--text-dim)", marginTop: "10px", lineHeight: 1.45 }}>
        Indicio basado en la carga, no un diagnóstico: otros factores (sueño, estrés, nutrición, descarga planificada) también cuentan. Los umbrales son criterio práctico, no valores validados en ensayos.
      </div>
    </section>
  );
}
