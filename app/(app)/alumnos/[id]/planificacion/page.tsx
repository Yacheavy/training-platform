import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { requireCoachOfStudent } from "@/lib/access";
import { PlanningView, type PlanningSearch } from "@/components/PlanningView";

export const maxDuration = 60;

/** El entrenador arma o ajusta la planificación de uno de sus alumnos. */
export default async function StudentPlanningPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<PlanningSearch> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const sp = await searchParams;
  const student = await requireCoachOfStudent(id).catch(() => null);
  if (!student) notFound();
  return (
    <>
      <div className="page-container-narrow" style={{ paddingBottom: 0 }}>
        <Link href={`/alumnos/${id}`} style={{ color: "var(--teal)", fontSize: "12.5px", textDecoration: "none" }}>← {student.name ?? student.email}</Link>
      </div>
      <PlanningView athleteId={id} sp={sp} coach={{ studentName: student.name ?? student.email }} />
    </>
  );
}
