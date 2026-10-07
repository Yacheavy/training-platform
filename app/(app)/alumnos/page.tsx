import { redirect } from "next/navigation";

/** Alumnos vive ahora dentro de Ajustes (pestaña Alumnos). */
export default function StudentsRedirect() {
  redirect("/settings?tab=alumnos");
}
