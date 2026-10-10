import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PlanningView, type PlanningSearch } from "@/components/PlanningView";

export const maxDuration = 60;

export default async function PlanningPage({ searchParams }: { searchParams: Promise<PlanningSearch> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <PlanningView athleteId={session.user.id} sp={sp} />;
}
