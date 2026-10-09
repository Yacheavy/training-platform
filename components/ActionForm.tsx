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
  confirm,
}: {
  action: (formData: FormData) => Promise<unknown> | unknown;
  success?: string | null;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Si se pasa, pide confirmación antes de ejecutar (para acciones que borran o reemplazan datos). */
  confirm?: string;
}) {
  return (
    <form
      className={className}
      style={style}
      onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
      action={async (formData: FormData) => {
        try {
          const result = await action(formData);
          // Las acciones pueden devolver { error } con un mensaje legible (en producción, un error lanzado llega sin mensaje)
          if (result && typeof result === "object" && "error" in result && typeof (result as { error: unknown }).error === "string") {
            toast((result as { error: string }).error, "error");
            return;
          }
          if (success) toast(success, "success");
        } catch (e) {
          // Un redirect() de la server action NO es un error: Next navega solo
          const info = `${(e as { digest?: string })?.digest ?? ""} ${e instanceof Error ? e.message : String(e)}`;
          if (/NEXT_REDIRECT/.test(info)) throw e;
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
