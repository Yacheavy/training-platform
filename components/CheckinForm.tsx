"use client";

import { useState } from "react";
import { saveCheckin } from "@/lib/checkin-actions";

const FIELDS = [
  { key: "sleepQuality", label: "Calidad de sueño" },
  { key: "fatigue", label: "Fatiga" },
  { key: "stress", label: "Estrés" },
  { key: "muscleSoreness", label: "Dolor muscular" },
  { key: "mood", label: "Ánimo" },
];

export function CheckinForm({
  existing,
}: {
  existing: { sleepQuality: number | null; fatigue: number | null; stress: number | null; muscleSoreness: number | null; mood: number | null; freeText: string | null } | null;
}) {
  const [values, setValues] = useState<Record<string, number>>({
    sleepQuality: existing?.sleepQuality ?? 4,
    fatigue: existing?.fatigue ?? 4,
    stress: existing?.stress ?? 4,
    muscleSoreness: existing?.muscleSoreness ?? 4,
    mood: existing?.mood ?? 4,
  });

  return (
    <form action={saveCheckin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {FIELDS.map((field) => (
        <div key={field.key}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{field.label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--teal)", fontWeight: 600 }}>
              {values[field.key]}
            </span>
          </div>
          <input
            type="range"
            name={field.key}
            min="1"
            max="7"
            value={values[field.key]}
            onChange={(e) => setValues({ ...values, [field.key]: Number(e.target.value) })}
            style={{ width: "100%" }}
          />
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
      <button
        type="submit"
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
      </button>
    </form>
  );
}