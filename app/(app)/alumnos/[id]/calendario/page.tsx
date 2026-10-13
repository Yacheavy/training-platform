import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCoachOfStudent } from "@/lib/access";
import { CalendarGrid } from "@/components/CalendarGrid";

/** El entrenador ve, día a día, las sesiones planificadas de un alumno (solo lectura) y entra a cada una. */
export default async function StudentCalendarPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string; month?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const student = await requireCoachOfStudent(id).catch(() => null);
  if (!student) notFound();

  const sp = await searchParams;
  const today = new Date();
  const year = sp.year ? parseInt(sp.year, 10) : today.getFullYear();
  const month = sp.month ? parseInt(sp.month, 10) : today.getMonth();
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

  const workouts = await prisma.generatedWorkout.findMany({
    where: { athleteId: id, date: { gte: startOfMonth, lte: endOfMonth } },
    select: { id: true, date: true, workoutLibraryKey: true, status: true, estimatedTss: true, estimatedKj: true, suggestedCarbsG: true, rationale: true, blocksJson: true },
  });

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const prev = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  const next = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
  const nav = { color: "var(--text)", textDecoration: "none", fontSize: "13px", background: "var(--grad-card)", border: "1px solid rgba(255,255,255,.08)", borderRadius: "999px", padding: "7px 14px" } as const;
  const base = `/alumnos/${id}/calendario`;

  return (
    <div className="page-container">
      <Link href={`/alumnos/${id}`} style={{ color: "var(--teal)", fontSize: "12.5px", textDecoration: "none" }}>← {student.name ?? student.email}</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", margin: "12px 0 20px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
          {monthNames[month]} {year}
          <span style={{ display: "block", fontSize: "13px", fontWeight: 400, color: "var(--text-muted)", letterSpacing: 0, marginTop: "2px" }}>Plan de {student.name ?? student.email}</span>
        </h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <a href={`${base}?year=${prev.year}&month=${prev.month}`} style={nav}>← Anterior</a>
          <a href={`${base}?year=${next.year}&month=${next.month}`} style={nav}>Siguiente →</a>
        </div>
      </div>

      <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "16px" }}>
        Vista de solo lectura: tocá una sesión para ver el detalle y abrirla completa. Para cambiar el plan usá «Planificación» del alumno.
      </div>

      <CalendarGrid
        year={year}
        month={month}
        ftp={student.ftp ?? 254}
        readOnly
        detailHref={(wid) => `/workouts/${wid}`}
        workouts={workouts.map((w) => ({
          ...w,
          date: w.date.toISOString(),
          blocksJson: w.blocksJson as unknown as { type: string; durationSec: number; targetWatts: number }[],
        }))}
      />
    </div>
  );
}
