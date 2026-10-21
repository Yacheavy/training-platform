"use client";

import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";
import { WeekEditor, ORDER, patchDay, weekStats, type Day } from "./WeekEditor";

export interface TemplateRow {
  dayOfWeek: number;
  stimulusType: string;
  isQualityDay: boolean;
  targetDurationMin: number | null;
}

const TYPE_OK = ["cycling", "gym", "flexibility", "rest"];

/** Semana tipo (Plan → Días de entrenamiento). Mismo editor que el asistente de puesta en marcha: tira de días, editor del día y gráfico de carga. */
export function TemplateEditor({
  slots,
  action,
}: {
  slots: TemplateRow[];
  action: (formData: FormData) => Promise<unknown>;
}) {
  const initial: Day[] = ORDER.map((d) => {
    const s = slots.find((x) => x.dayOfWeek === d);
    return {
      dayOfWeek: d,
      type: (s && TYPE_OK.includes(s.stimulusType) ? s.stimulusType : "rest") as Day["type"],
      quality: s?.isQualityDay ?? false,
      min: s?.targetDurationMin != null ? String(s.targetDurationMin) : "",
    };
  });
  const [rows, setRows] = useState<Day[]>(initial);
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);
  const { badMin } = weekStats(rows);

  return (
    <ActionForm action={action} success="Plantilla guardada. Regenerá el plan para que use los cambios.">
      <WeekEditor days={rows} onChangeDay={(d, patch) => setRows((prev) => prev.map((r) => (r.dayOfWeek === d ? patchDay(r, patch) : r)))} />

      {rows.map((r) => (
        <span key={r.dayOfWeek}>
          <input type="hidden" name={`type_${r.dayOfWeek}`} value={r.type} />
          {r.quality && <input type="hidden" name={`quality_${r.dayOfWeek}`} value="on" />}
          <input type="hidden" name={`min_${r.dayOfWeek}`} value={r.min} />
        </span>
      ))}

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
        <SubmitButton pendingText="Guardando…" disabled={!dirty || badMin}>
          Guardar plantilla
        </SubmitButton>
        {dirty ? (
          <span style={{ fontSize: "12px", color: "var(--amber)" }}>● Cambios sin guardar</span>
        ) : (
          <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Sin cambios</span>
        )}
      </div>
    </ActionForm>
  );
}
