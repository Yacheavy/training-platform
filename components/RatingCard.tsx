"use client";

import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";
import { RatingFields } from "./RatingFields";

/** RPE y sensación de una salida: se pueden cargar o corregir acá; se envían también a Intervals. */
export function RatingCard({ activityId, rpe, feel, action }: { activityId: string; rpe: number | null; feel: number | null; action: (formData: FormData) => Promise<unknown> }) {
  const [touched, setTouched] = useState(false);
  return (
    <ActionForm action={action} success="Guardado y enviado a Intervals" style={{ display: "grid", gap: "14px" }}>
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="intent" value="rating" />
      <RatingFields rpe={rpe} feel={feel} onTouch={() => setTouched(true)} />
      <div>
        <SubmitButton pendingText="Guardando…" disabled={!touched}>
          {rpe != null || feel != null ? "Actualizar" : "Guardar"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
