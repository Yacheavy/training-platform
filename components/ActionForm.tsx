"use client";

import type { CSSProperties, ReactNode } from "react";
import { toast } from "./Toaster";

/**
 * <form> que ejecuta una server action y avisa el resultado con un toast.
 * - success: texto del aviso de éxito; null = no avisar (acciones que redirigen y ya muestran su mensaje).
 * - Si la acción lanza un error, se muestra un aviso rojo en lugar de fallar en silencio.
 */
export function ActionForm({
  action,
  success = "Guardado",
  children,
  className,
  style,
}: {
  action: (formData: FormData) => Promise<unknown> | unknown;
  success?: string | null;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <form
      className={className}
      style={style}
      action={async (formData: FormData) => {
        try {
          await action(formData);
          if (success) toast(success, "success");
        } catch (e) {
          // Los redirects de Next no llegan acá; esto es un error real
          const msg = e instanceof Error && e.message && !/server components render/i.test(e.message) ? e.message : "";
          toast(msg ? `No se pudo completar: ${msg}` : "No se pudo completar la acción. Probá de nuevo.", "error");
        }
      }}
    >
      {children}
    </form>
  );
}
