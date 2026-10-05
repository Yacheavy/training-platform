"use client";

import { useState } from "react";
import { saveCheckin } from "@/lib/checkin-actions";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";

const FIELDS = [
  { key: "sleepQuality", label: "Calidad de sueño", low: "1 = pésimo", high: "7 = excelente" },
  { key: "fatigue", label: "Fatiga", low: "1 = nada", high: "7 = agotado" },
  { key: "stress", label: "Estrés", low: "1 = nada", high: "7 = muy alto" },
  { key: "muscleSoreness", label: "Dolor muscular", low: "1 = nada", high: "7 = muy fuerte" },
  { key: "mood", label: "Ánimo", low: "1 = muy bajo", high: "7 = excelente" },
];

export function CheckinForm({
  existing,
}: {
  existing: { sleepQuality: number | null; fatigue: number | null; stress: number | null; muscleSoreness: number | null; mood: number | null; freeText: string | null } | null;
}) {
  const [values, setValues] = useState<Record<string, number | null>>({
    // Sin valor por defecto: cada respuesta debe ser consciente (un 4 precargado sesga los datos)
    sleepQuality: existing?.sleepQuality ?? null,
    fatigue: existing?.fatigue ?? null,
    stress: existing?.stress ?? null,
    muscleSoreness: existing?.muscleSoreness ?? null,
    mood: existing?.mood ?? null,
  });
  const complete = FIELDS.every((f) => values[f.key] != null);

  return (
    <ActionForm action={saveCheckin} success="Check-in guardado" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {FIELDS.map((field) => (
        <div key={field.key}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{field.label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--teal)", fontWeight: 600 }}>
              {values[field.key] ?? "—"}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="7"
            value={values[field.key] ?? 4}
            onChange={(e) => setValues({ ...values, [field.key]: Number(e.target.value) })}
            style={{ width: "100%", opacity: values[field.key] == null ? 0.45 : 1 }}
          />
          {values[field.key] != null && <input type="hidden" name={field.key} value={values[field.key]!} />}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "var(--text-dim)" }}>
            <span>{field.low}</span>
            <span>{field.high}</span>
          </div>
        </div>
      ))}
      <textarea
        name="freeText"
        placeholder="Algo más que quieras contar (opcional)..."
        defaultValue={existing?.freeText ?? ""}
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          color: "var(--text)",
          padding: "10px",
          fontSize: "12.5px",
          minHeight: "50px",
          resize: "vertical",
        }}
      />
      <SubmitButton
        pendingText="Guardando…"
        disabled={!complete}
        style={{
          background: "var(--teal)",
          color: "#0A1310",
          border: "none",
          borderRadius: "8px",
          padding: "10px",
          fontWeight: 600,
          fontSize: "13px",
          cursor: "pointer",
        }}
      >
        {existing ? "Actualizar check-in" : "Guardar check-in de hoy"}
      </SubmitButton>
    </ActionForm>
  );
}