import type { PlanDb } from "@/lib/training-engine/generate-full-plan";
import { generateFullPlan } from "@/lib/training-engine/generate-full-plan";
import { getSeasonState, instantForKey } from "@/lib/season-data";

/** Crea los bloques propuestos y genera sus sesiones en orden (lógica de applySeason, sin sesión ni caché). */
export async function applySeasonCore(db: PlanDb, athleteId: string, now = new Date()): Promise<{ error: string } | { blocks: number; sessions: number; skipped: number; warnings: string[] }> {
  const user = await db.user.findUnique({ where: { id: athleteId }, select: { ftp: true } });
  if (!user?.ftp) return { error: "Cargá tu FTP en Ajustes antes de generar la temporada." };
  const slots = await db.trainingTemplateSlot.findMany({ where: { athleteId } });
  if (!slots.some((x) => x.stimulusType !== "rest")) return { error: "Armá tu semana tipo (qué días entrenás) antes de generar la temporada." };
  const state = await getSeasonState(athleteId, now, db);
  if (state.proposal.covered || state.proposal.blocks.length === 0) return { error: "No hay bloques nuevos para crear." };
  let sessions = 0;
  let skipped = 0;
  const warnings: string[] = [];
  for (const b of state.proposal.blocks) {
    const block = await db.trainingBlock.create({
      data: { athleteId, name: b.name, objective: b.objective, startDate: instantForKey(state, b.startKey), endDate: instantForKey(state, b.endKey), plannedWeeklyTssProgression: [] },
    });
    const r = await generateFullPlan(block.id, { athleteId, now }, db);
    sessions += r.created;
    skipped += r.skipped;
    warnings.push(...r.warnings);
  }
  return { blocks: state.proposal.blocks.length, sessions, skipped, warnings };
}
