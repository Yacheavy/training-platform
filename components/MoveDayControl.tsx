"use client";

import { ActionForm } from "./ActionForm";

/** Botón «Mover de día»: al tocarlo se abre el selector de fecha del teléfono y al elegir el día se mueve la sesión. */
export function MoveDayControl({
  action, workoutId, defaultDate, className,
}: {
  action: (formData: FormData) => Promise<unknown>;
  workoutId: string;
  defaultDate: string;
  className?: string;
}) {
  return (
    <ActionForm action={action} success="Sesión movida" style={{ display: "contents" }}>
      <input type="hidden" name="workoutId" value={workoutId} />
      <label className={className} style={{ position: "relative", cursor: "pointer", overflow: "hidden" }}>
        Mover de día
        <input
          type="date"
          name="date"
          required
          defaultValue={defaultDate}
          aria-label="Mover a otro día"
          onChange={(e) => { if (e.currentTarget.value) e.currentTarget.form?.requestSubmit(); }}
          style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
        />
      </label>
    </ActionForm>
  );
}
