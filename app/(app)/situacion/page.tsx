import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { dateKeyLocal } from "@/lib/tz";
import { BackLink } from "@/components/BackLink";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { applySituation } from "@/lib/situation-actions";
import { loadSituationPlan, parseKind, parseTripDates } from "@/lib/situation-data";
import { STIMULUS_LABELS } from "@/lib/labels";

const sessionLabel = (k: string) => STIMULUS_LABELS[k] ?? k;
import { inputStyle, labelStyle, btnStyle } from "@/components/ui-styles";
import type { SituationKind } from "@/lib/training-engine/situation";

const OPTIONS: { kind: SituationKind; title: string; sub: string }[] = [
  { kind: "sick_neck", title: "Estoy enfermo, de cuello para arriba", sub: "Garganta, congestión, sin fiebre ni dolor en el cuerpo" },
  { kind: "sick_body", title: "Estoy enfermo, con fiebre o síntomas generales", sub: "Fiebre, tos de pecho, dolor muscular o malestar general" },
  { kind: "travel", title: "Viajo", sub: "Días en los que no vas a poder entrenar" },
];

const dayLabel = (key: string) => {
  const d = new Date(`${key}T12:00:00Z`);
  return `${["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getUTCDay()]} ${key.slice(8)}/${key.slice(5, 7)}`;
};

export default async function SituacionPage({ searchParams }: { searchParams: Promise<{ kind?: string; from?: string; to?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const sp = await searchParams;
  const kind = parseKind(sp.kind);
  const todayKey = dateKeyLocal(new Date());

  let preview: Awaited<ReturnType<typeof loadSituationPlan>> | null = null;
  let tripError: string | null = null;
  let trip: { from: string; to: string } | undefined;
  if (kind === "travel" && (sp.from || sp.to)) {
    const t = parseTripDates(sp.from, sp.to, todayKey);
    if ("error" in t) tripError = t.error;
    else trip = t;
  }
  if (kind && (kind !== "travel" || trip)) preview = await loadSituationPlan(session.user.id, kind, trip);

  return (
    <div className="page-container">
      <BackLink fallback="/dashboard" />
      <h1 style={{ fontSize: "22px", margin: "6px 0 4px" }}>¿Pasó algo?</h1>
      <p style={{ color: "var(--text-muted)", fontSize: "13.5px", margin: "0 0 16px", lineHeight: 1.5 }}>
        Contanos qué cambió y te mostramos cómo quedaría el plan. No se cambia nada hasta que lo confirmes.
      </p>

      <div style={{ display: "grid", gap: "10px" }}>
        {OPTIONS.map((o) => (
          <a
            key={o.kind}
            href={`/situacion?kind=${o.kind}`}
            style={{ display: "block", textDecoration: "none", padding: "14px 16px", borderRadius: "var(--r-lg)", border: `1.5px solid ${kind === o.kind ? "var(--teal)" : "var(--border)"}`, background: kind === o.kind ? "color-mix(in srgb, var(--teal) 8%, var(--surface))" : "var(--surface)" }}
          >
            <div style={{ fontSize: "15px", fontWeight: 700 }}>{o.title}</div>
            <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "3px" }}>{o.sub}</div>
          </a>
        ))}
      </div>

      {kind === "travel" && (
        <form method="get" action="/situacion" style={{ marginTop: "16px", display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr" }}>
          <input type="hidden" name="kind" value="travel" />
          <div>
            <label style={labelStyle} htmlFor="from">Salgo el</label>
            <input id="from" name="from" type="date" min={todayKey} defaultValue={sp.from ?? todayKey} style={inputStyle} required />
          </div>
          <div>
            <label style={labelStyle} htmlFor="to">Vuelvo el</label>
            <input id="to" name="to" type="date" min={todayKey} defaultValue={sp.to ?? ""} style={inputStyle} required />
          </div>
          <button type="submit" style={{ ...btnStyle, gridColumn: "1 / -1" }}>Ver cómo queda el plan</button>
          {tripError && <div style={{ gridColumn: "1 / -1", color: "var(--red)", fontSize: "13px" }}>{tripError}</div>}
        </form>
      )}

      {preview && "error" in preview && <div style={{ marginTop: "16px", color: "var(--red)", fontSize: "13.5px" }}>{preview.error}</div>}

      {preview && !("error" in preview) && (
        <section style={{ marginTop: "18px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-lg)", padding: "16px", background: "var(--grad-card)" }}>
          <h2 style={{ fontSize: "15.5px", margin: "0 0 10px" }}>Así quedaría el plan</h2>
          {preview.plan.changes.length === 0 ? (
            <div style={{ fontSize: "13.5px", color: "var(--text-muted)" }}>No hay sesiones pendientes que cambiar con esta situación.</div>
          ) : (
            <>
              <div style={{ display: "grid", gap: "8px" }}>
                {preview.plan.changes.map((c) => (
                  <div key={c.workoutId} style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 12px", borderRadius: "12px", background: "rgba(127,127,127,.08)", fontSize: "13.5px" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{dayLabel(c.dayKey)}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "2px" }}>{c.reason}</div>
                    </div>
                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ color: "var(--text-muted)", textDecoration: "line-through" }}>{sessionLabel(c.fromKey)} · {c.fromMin} min</div>
                      <div style={{ color: c.kind === "rest" ? "var(--amber)" : "var(--teal)", fontWeight: 700 }}>{c.kind === "rest" ? "Descanso" : `Rodaje suave · ${c.toMin} min`}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "12px", lineHeight: 1.5 }}>{preview.plan.evidenceNote}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px", lineHeight: 1.5 }}>
                Las sesiones que ya estaban en Intervals se actualizan o se borran allá también.
              </div>
              <ActionForm action={applySituation} success="Plan actualizado" style={{ marginTop: "14px" }}>
                <input type="hidden" name="kind" value={kind!} />
                {trip && <><input type="hidden" name="from" value={trip.from} /><input type="hidden" name="to" value={trip.to} /></>}
                <SubmitButton pendingText="Aplicando…" style={{ ...btnStyle, width: "100%" }}>Aplicar estos cambios</SubmitButton>
              </ActionForm>
            </>
          )}
        </section>
      )}
    </div>
  );
}
