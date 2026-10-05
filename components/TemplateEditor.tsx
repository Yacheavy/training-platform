"use client";

import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const TYPES = [
  { value: "cycling", label: "Ciclismo" },
  { value: "gym", label: "Gimnasio" },
  { value: "rest", label: "Descanso" },
];

export interface TemplateRow {
  dayOfWeek: number;
  stimulusType: string;
  isQualityDay: boolean;
  targetDurationMin: number | null;
}

/** Orden de visualización: lunes → domingo (el día 0 es domingo en los datos). */
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function TemplateEditor({
  slots,
  action,
}: {
  slots: TemplateRow[];
  action: (formData: FormData) => Promise<unknown>;
}) {
  const initial = ORDER.map((d) => {
    const s = slots.find((x) => x.dayOfWeek === d);
    return {
      dayOfWeek: d,
      type: s?.stimulusType ?? "rest",
      quality: s?.isQualityDay ?? false,
      min: s?.targetDurationMin != null ? String(s.targetDurationMin) : "",
    };
  });
  const [rows, setRows] = useState(initial);
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);

  const update = (d: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((prev) =>
      prev.map((r) => {
        if (r.dayOfWeek !== d) return r;
        const next = { ...r, ...patch };
        if (next.type !== "cycling") next.quality = false;
        if (next.type === "rest") next.min = "";
        if (patch.type && patch.type !== "rest" && next.min === "") next.min = patch.type === "gym" ? "60" : "60";
        return next;
      })
    );

  const missingMin = rows.some((r) => r.type === "cycling" && !(Number(r.min) >= 15 && Number(r.min) <= 600));
  const cycling = rows.filter((r) => r.type === "cycling");
  const quality = rows.filter((r) => r.quality);
  const totalMin = cycling.reduce((s, r) => s + (Number(r.min) || 0), 0);

  // Dos días de calidad pegados (circular) dejan menos de 48 h entre sesiones intensas
  const adjacentQuality = quality.some((a) =>
    quality.some((b) => a !== b && Math.min(Math.abs(a.dayOfWeek - b.dayOfWeek), 7 - Math.abs(a.dayOfWeek - b.dayOfWeek)) < 2)
  );

  const seg = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "7px 4px",
    fontSize: "12px",
    fontWeight: 600,
    border: "none",
    borderRight: "1px solid #2A3441",
    background: active ? "#4FD1C5" : "transparent",
    color: active ? "#0A1310" : "#8A97A6",
    cursor: "pointer",
  });

  return (
    <ActionForm action={action} success="Plantilla guardada. Regenerá el plan para que use los cambios.">
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {rows.map((r) => (
          <div
            key={r.dayOfWeek}
            className="tpl-row"
            style={{
              display: "grid",
              gridTemplateColumns: "92px minmax(0, 1fr) auto 84px",
              gap: "10px",
              alignItems: "center",
              padding: "8px 10px",
              borderRadius: "10px",
              border: "1px solid #2A3441",
              background: r.type === "rest" ? "transparent" : "#1B2530",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 600 }}>{DAYS[r.dayOfWeek]}</div>

            <div style={{ display: "flex", border: "1px solid #2A3441", borderRadius: "8px", overflow: "hidden" }} role="radiogroup" aria-label={`Tipo de día ${DAYS[r.dayOfWeek]}`}>
              {TYPES.map((t) => (
                <button key={t.value} type="button" className="btn" role="radio" aria-checked={r.type === t.value} onClick={() => update(r.dayOfWeek, { type: t.value })} style={seg(r.type === t.value)}>
                  {t.label}
                </button>
              ))}
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: r.type === "cycling" ? "#E7ECF2" : "#5A6673", cursor: r.type === "cycling" ? "pointer" : "not-allowed" }}>
              <input
                type="checkbox"
                checked={r.quality}
                disabled={r.type !== "cycling"}
                onChange={(e) => update(r.dayOfWeek, { quality: e.target.checked })}
                style={{ width: "18px", height: "18px" }}
              />
              Calidad
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <input
                type="number"
                inputMode="numeric"
                min={15}
                max={600}
                value={r.min}
                disabled={r.type === "rest"}
                placeholder="—"
                onChange={(e) => update(r.dayOfWeek, { min: e.target.value })}
                aria-label={`Minutos ${DAYS[r.dayOfWeek]}`}
                style={{
                  background: "#242F3B",
                  border: `1px solid ${r.type === "cycling" && !(Number(r.min) >= 15) ? "#E5636A" : "#2A3441"}`,
                  borderRadius: "7px",
                  color: "#E7ECF2",
                  padding: "7px 6px",
                  fontSize: "13px",
                  width: "100%",
                  opacity: r.type === "rest" ? 0.4 : 1,
                }}
              />
              <span style={{ fontSize: "11px", color: "#5A6673" }}>min</span>
            </div>

            <input type="hidden" name={`type_${r.dayOfWeek}`} value={r.type} />
            {r.quality && <input type="hidden" name={`quality_${r.dayOfWeek}`} value="on" />}
            <input type="hidden" name={`min_${r.dayOfWeek}`} value={r.min} />
          </div>
        ))}
      </div>

      <div style={{ fontSize: "12px", color: "#8A97A6", marginTop: "12px" }}>
        {cycling.length} día{cycling.length === 1 ? "" : "s"} de ciclismo · {quality.length} de calidad · {Math.floor(totalMin / 60)}h {String(totalMin % 60).padStart(2, "0")}min de ciclismo por semana
      </div>
      {adjacentQuality && (
        <div style={{ fontSize: "12px", color: "#E8A33D", marginTop: "6px" }}>
          Hay días de calidad seguidos: el generador necesita al menos 48 h entre sesiones de VO2max, así que uno de ellos pasará a Z2.
        </div>
      )}
      {quality.length === 0 && cycling.length > 0 && (
        <div style={{ fontSize: "12px", color: "#E8A33D", marginTop: "6px" }}>No marcaste ningún día de calidad: todas las sesiones serán Z2.</div>
      )}
      {missingMin && <div style={{ fontSize: "12px", color: "#E5636A", marginTop: "6px" }}>Cada día de ciclismo necesita una duración de 15 a 600 min.</div>}

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "14px", flexWrap: "wrap" }}>
        <SubmitButton
          pendingText="Guardando…"
          disabled={!dirty || missingMin}
          style={{ background: "#4FD1C5", color: "#0A1310", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "13px", fontWeight: 600 }}
        >
          Guardar plantilla
        </SubmitButton>
        {dirty ? (
          <span style={{ fontSize: "12px", color: "#E8A33D" }}>● Cambios sin guardar</span>
        ) : (
          <span style={{ fontSize: "12px", color: "#5A6673" }}>Sin cambios</span>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .tpl-row { grid-template-columns: 1fr 1fr !important; }
          .tpl-row > div:nth-child(2) { grid-column: 1 / -1; order: 3; }
        }
      `}</style>
    </ActionForm>
  );
}
