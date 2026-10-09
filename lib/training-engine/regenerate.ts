import { generateFullPlan, type PlanDb } from "./generate-full-plan";
import { dateKeyLocal } from "../tz";

/**
 * Regenera las sesiones planificadas desde `from` en todos los bloques que llegan a esa fecha.
 * Las sesiones de rodillo no se borran: se actualizan en su lugar para conservar el rodillo (una restricción real, p. ej. lluvia).
 * Cada bloque borra SOLO su propia ventana de fechas (el día de fin pertenece al bloque siguiente si empieza ese día):
 * así procesar un bloque nunca pisa lo recién creado del anterior.
 */
export async function regenerateBlocks(db: PlanDb, athleteId: string, from: Date, now = new Date()) {
  const blocks = await db.trainingBlock.findMany({ where: { athleteId, endDate: { gte: from } }, orderBy: { startDate: "asc" } });
  let created = 0;
  let skipped = 0;
  const resend: string[] = [];
  const warnings: string[] = [];
  const failedBlocks: string[] = [];
  const dayUtc = (d: Date) => new Date(dateKeyLocal(d) + "T00:00:00Z");
  const startKeys = new Set(blocks.map((x) => dateKeyLocal(x.startDate)));
  for (const b of blocks) {
    const lo = new Date(Math.max(from.getTime(), dayUtc(b.startDate).getTime()));
    const hi = new Date(dayUtc(b.endDate).getTime() + (startKeys.has(dateKeyLocal(b.endDate)) ? 0 : 24 * 60 * 60 * 1000));
    try {
      await db.generatedWorkout.deleteMany({ where: { athleteId, status: { in: ["PLANNED", "SUGGESTED"] }, environment: { not: "indoor" }, date: { gte: lo, lt: hi } } });
      const r = await generateFullPlan(b.id, { fromDate: from, athleteId, replaceAll: true, now }, db);
      created += r.created;
      skipped += r.skipped;
      resend.push(...r.resendIds);
      warnings.push(...r.warnings);
    } catch (e) {
      console.error("regenerateBlocks: falló el bloque", b.name, e);
      failedBlocks.push(b.name);
    }
  }
  return { created, skipped, resend, warnings, failedBlocks };
}
