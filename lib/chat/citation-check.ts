import { ALLOWED_CITATION_SURNAMES } from "./references";

const NAME = "[A-ZÁÉÍÓÚÑØ][\\p{L}'’-]{2,}";
const CITATION = new RegExp(`(${NAME})(?:\\s+(?:et al\\.?|y col\\.?|(?:&|y)\\s+${NAME}))?,?\\s*\\(?((?:19|20)\\d{2})\\b`, "gu");

// Palabras con mayúscula que van seguidas de un año pero no son citas
const NOT_AUTHORS = new Set(
  [
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "setiembre", "octubre", "noviembre", "diciembre",
    "lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado", "domingo",
    "hoy", "ayer", "mañana", "semana", "desde", "hasta", "durante", "fuentes", "fuente", "versión", "version", "plan", "bloque", "sesión", "sesion",
  ].map((w) => w.toLowerCase())
);

/** Apellidos citados (autor + año) que NO están en la bibliografía cerrada del asistente. */
export function findUnverifiedCitations(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(CITATION)) {
    const surname = m[1];
    const parts = surname.toLowerCase().split("-");
    if (parts.some((p) => NOT_AUTHORS.has(p))) continue;
    if (parts.some((p) => ALLOWED_CITATION_SURNAMES.has(p)) || ALLOWED_CITATION_SURNAMES.has(surname.toLowerCase())) continue;
    found.add(`${surname} ${m[2]}`);
  }
  return [...found];
}
