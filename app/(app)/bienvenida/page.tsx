import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import type { OnboardingPayload } from "@/lib/onboarding-actions";

const DEFAULT_DAYS: OnboardingPayload["days"] = [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({ dayOfWeek, type: "rest" as const, quality: false, min: "" }));

/** Puesta en marcha guiada del alumno (5 pasos). Si ya cargó algo, el asistente arranca con eso. */
export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const id = session.user.id;
  const [user, slots, goal] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { name: true, ftp: true, weight: true, coachId: true, email: true, trainingBackground: true, currentStateNote: true, preferences: true } }),
    prisma.trainingTemplateSlot.findMany({ where: { athleteId: id } }),
    prisma.athleteGoal.findFirst({ where: { athleteId: id, goalType: "EVENT", eventDate: { gte: new Date() } }, orderBy: { eventDate: "asc" } }),
  ]);
  if (!user) redirect("/login");
  const invite = await prisma.allowedEmail.findFirst({ where: { email: user.email }, select: { invitedById: true } });
  const coachId = invite?.invitedById ?? user.coachId;
  const coach = coachId && coachId !== id ? await prisma.user.findUnique({ where: { id: coachId }, select: { name: true } }) : null;

  const initial: OnboardingPayload = {
    ftp: user.ftp ? String(user.ftp) : "",
    weight: user.weight ? String(user.weight) : "",
    days: DEFAULT_DAYS.map((d) => {
      const s = slots.find((x) => x.dayOfWeek === d.dayOfWeek);
      const type = (s && ["cycling", "gym", "flexibility", "rest"].includes(s.stimulusType) ? s.stimulusType : "rest") as OnboardingPayload["days"][number]["type"];
      return s ? { dayOfWeek: d.dayOfWeek, type, quality: s.isQualityDay, min: s.targetDurationMin != null ? String(s.targetDurationMin) : "" } : d;
    }),
    goal: goal
      ? { mode: "event", name: goal.name, date: goal.eventDate!.toISOString().slice(0, 10), priority: goal.priority as "A" | "B" | "C", profile: goal.courseProfile ?? "" }
      : { mode: "event", name: "", date: "", priority: "A", profile: "" },
    background: user.trainingBackground ?? "",
    injuries: user.currentStateNote ?? "",
    preferences: user.preferences ?? "",
  };
  return <OnboardingWizard initial={initial} coachName={coach?.name ?? null} hasCoach={!!coach} name={user.name?.split(" ")[0] ?? ""} />;
}
