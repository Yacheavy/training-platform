import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";
import { saveActivityNutrition, applyPlannedNutrition } from "@/lib/nutrition-actions";

const inputStyle = {
  width: "100%", background: "var(--surface-2, transparent)", border: "1px solid var(--border)", borderRadius: "8px",
  padding: "8px 10px", color: "inherit", fontFamily: "var(--font-mono)", fontSize: "14px",
} as const;
const labelStyle = { fontSize: "11px", color: "var(--text-dim)", display: "block", marginBottom: "4px" } as const;

export interface NutritionFormValues {
  carbsG: number | null;
  fluidMl: number | null;
  sodiumMg: number | null;
  giComfort: number | null;
  followedPlan: boolean;
  intervalsCarbsG: number | null;
}

/** Registro de lo consumido durante la sesión. Todo opcional; vacío = sin dato. */
export function NutritionForm({
  activityId, hours, targetGPerHour, values,
}: {
  activityId: string;
  hours: number;
  targetGPerHour: number;
  values: NutritionFormValues;
}) {
  const plannedG = Math.round(targetGPerHour * hours);
  const hasAny = values.carbsG != null || values.fluidMl != null || values.sodiumMg != null || values.giComfort != null;
  const hasSodium = values.sodiumMg != null;

  return (
    <div>
      {targetGPerHour > 0 ? (
        <div style={{ fontSize: "12.5px", marginBottom: "12px", color: "var(--text-muted)" }}>
          Sugerido para esta sesión: <b style={{ color: "var(--text)" }}>{plannedG} g de CHO</b> (~{Math.round(targetGPerHour)} g/h).
        </div>
      ) : (
        <div style={{ fontSize: "12.5px", marginBottom: "12px", color: "var(--text-muted)" }}>
          En una salida de esta duración no se sugieren carbohidratos; igual podés registrar lo que tomaste.
        </div>
      )}

      {targetGPerHour > 0 && (
        <ActionForm action={applyPlannedNutrition} success="Registrado: consumiste lo planificado" style={{ marginBottom: "14px" }}>
          <input type="hidden" name="activityId" value={activityId} />
          <SubmitButton variant="secondary" pendingText="Guardando…">
            Consumí lo planificado ({plannedG} g)
          </SubmitButton>
        </ActionForm>
      )}

      <ActionForm action={saveActivityNutrition} success="Nutrición guardada" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <input type="hidden" name="activityId" value={activityId} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
          <div>
            <label style={labelStyle} htmlFor="carbsG">Carbohidratos (g)</label>
            <input id="carbsG" name="carbsG" type="number" inputMode="numeric" min={0} max={400} defaultValue={values.carbsG ?? ""} placeholder={values.intervalsCarbsG != null ? `Intervals: ${Math.round(values.intervalsCarbsG)}` : "—"} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="fluidMl">Líquido (ml)</label>
            <input id="fluidMl" name="fluidMl" type="number" inputMode="numeric" min={0} max={8000} step={50} defaultValue={values.fluidMl ?? ""} placeholder="—" style={inputStyle} />
          </div>
        </div>

        <details open={hasSodium}>
          <summary style={{ fontSize: "12px", color: "var(--teal)", cursor: "pointer" }}>Sodio (opcional)</summary>
          <div style={{ marginTop: "8px", maxWidth: "200px" }}>
            <label style={labelStyle} htmlFor="sodiumMg">Sodio (mg)</label>
            <input id="sodiumMg" name="sodiumMg" type="number" inputMode="numeric" min={0} max={12000} step={50} defaultValue={values.sodiumMg ?? ""} placeholder="—" style={inputStyle} />
          </div>
        </details>

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ ...labelStyle, padding: 0 }}>Tolerancia digestiva</legend>
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", fontSize: "13px" }}>
            {[
              [3, "Sin problemas"],
              [2, "Aceptable"],
              [1, "Con molestias"],
            ].map(([v, l]) => (
              <label key={v} style={{ display: "flex", gap: "6px", alignItems: "center", cursor: "pointer" }}>
                <input type="radio" name="giComfort" value={v} defaultChecked={values.giComfort === v} /> {l}
              </label>
            ))}
            <label style={{ display: "flex", gap: "6px", alignItems: "center", cursor: "pointer", color: "var(--text-dim)" }}>
              <input type="radio" name="giComfort" value="" defaultChecked={values.giComfort == null} /> Sin dato
            </label>
          </div>
        </fieldset>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <SubmitButton pendingText="Guardando…">
            {hasAny ? "Actualizar registro" : "Guardar registro"}
          </SubmitButton>
          {values.followedPlan && <span style={{ fontSize: "11.5px", color: "var(--text-dim)" }}>Cargado con “consumí lo planificado”</span>}
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
          Dejar un campo vacío significa “sin dato” (no cuenta como cero). La IA usa este registro para analizar tu alimentación.
        </div>
      </ActionForm>
    </div>
  );
}
