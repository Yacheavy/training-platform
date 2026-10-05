"use client";

import { useFormStatus } from "react-dom";
import type { CSSProperties, ReactNode } from "react";

/**
 * Botón de envío con estado visible: mientras el formulario se procesa muestra
 * un spinner, se deshabilita (evita doble clic) y cambia el texto si se pasa `pendingText`.
 */
export function SubmitButton({
  children,
  pendingText,
  style,
  disabled,
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  style?: CSSProperties;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={`btn ${className ?? ""}`}
      style={{ ...style, opacity: pending || disabled ? 0.7 : 1, cursor: pending ? "progress" : disabled ? "not-allowed" : "pointer" }}
    >
      {pending && <span className="spinner" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
