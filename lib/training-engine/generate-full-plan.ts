import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma";
import { buildPlan, PlanLibraryEntry } from "./plan-builder";
import { validatePlan } from "./plan-validator";
import { dateKeyLocal } from "../tz";

export async function generateFullPlan(trainingBlockId: string) {
  const block = await prisma.trainingBlock.findUnique({ where: { id: trainingBlockId } });
  if (!block) throw new Error("Bloque no encontrado");

  const user = await prisma.user.findUnique({ where: { id: block.athleteId } });
  if (!user?.ftp) throw new Error("Configurá tu FTP antes de generar un plan completo");

  const thresholds = await prisma.athleteThresholds.findUnique({ where: { athleteId: block.athleteId } });
  const template = await prisma.trainingTemplateSlot.findMany({ where: { athleteId: block.athleteId } });
  const libraryRows = await prisma.workoutLibraryEntry.findMany();
  const library: Record<string, PlanLibraryEntry> = Object.fromEntries(libraryRows.map((l) => [l.key, l]));

  const plan = buildPlan({
    block: { name: block.name, objective: block.objective, startDate: block.startDate, endDate: block.endDate },
    ftp: user.ftp,
    thresholds: {
      deloadRatio: thresholds?.deloadRatio ?? "4:1",
      weeksBetweenFtpTest: thresholds?.weeksBetweenFtpTest ?? 5,
      ftpTestProtocol: thresholds?.ftpTestProtocol,
    },
    template,
    library,
  });

  // Red de seguridad: si el plan viola una regla del protocolo se avisa en la respuesta.
  const warnings = validatePlan(plan, { objective: block.objective, ftp: user.ftp });

  const created: string[] = [];
  const skipped: string[] = [];

  for (const day of plan) {
    const key = dateKeyLocal(day.date);
    try {
      const existing = await prisma.generatedWorkout.findFirst({
        where: {
          athleteId: block.athleteId,
          date: { gte: day.date, lt: new Date(day.date.getTime() + 86400000) },
          status: "PLANNED",
        },
      });
      if (existing) {
        skipped.push(key);
        continue;
      }

      await prisma.generatedWorkout.create({
        data: {
          athleteId: block.athleteId,
          date: day.date,
          workoutLibraryKey: day.stimulusType,
          status: "PLANNED",
          blocksJson: day.blocks as unknown as Prisma.InputJsonValue,
          estimatedTss: day.tss,
          estimatedKj: day.fueling.totalKj,
          suggestedCarbsG: day.fueling.suggestedCarbsG,
          suggestedCarbsGPerHour: day.fueling.suggestedCarbsGPerHour,
          requiresMultipleCarbSources: day.fueling.requiresMultipleCarbSources,
          rationale: day.rationale,
        },
      });
      created.push(key);
    } catch (err) {
      skipped.push(`${key} (error: ${String(err)})`);
    }
  }

  return { created: created.length, skipped: skipped.length, createdDates: created, skippedDates: skipped, warnings };
}
