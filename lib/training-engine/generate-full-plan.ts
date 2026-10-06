import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma";
import { buildPlan, PlanLibraryEntry } from "./plan-builder";
import { validatePlan } from "./plan-validator";
import { dateKeyLocal } from "../tz";

export async function generateFullPlan(trainingBlockId: string, opts?: { fromDate?: Date; athleteId?: string; replaceDate?: Date }) {
  const block = await prisma.trainingBlock.findUnique({ where: { id: trainingBlockId } });
  if (!block || (opts?.athleteId && block.athleteId !== opts.athleteId)) throw new Error("Bloque no encontrado");

  const user = await prisma.user.findUnique({ where: { id: block.athleteId } });
  if (!user?.ftp) throw new Error("Configurá tu FTP antes de generar un plan completo");

  const thresholds = await prisma.athleteThresholds.findUnique({ where: { athleteId: block.athleteId } });
  const template = await prisma.trainingTemplateSlot.findMany({ where: { athleteId: block.athleteId } });
  const libraryRows = await prisma.workoutLibraryEntry.findMany();
  const library: Record<string, PlanLibraryEntry> = Object.fromEntries(libraryRows.map((l) => [l.key, l]));

  const plan = buildPlan({
    block: { name: block.name, objective: block.objective, startDate: block.startDate, endDate: block.endDate },
    ftp: user.ftp,
    pvo2maxWatts: user.pvo2maxWatts,
    thresholds: {
      deloadRatio: thresholds?.deloadRatio ?? "4:1",
      weeksBetweenFtpTest: thresholds?.weeksBetweenFtpTest ?? 5,
      ftpTestProtocol: thresholds?.ftpTestProtocol,
      vo2Stimulus: thresholds?.vo2Stimulus,
    },
    template,
    library,
  });

  // Red de seguridad: si el plan viola una regla del protocolo se avisa en la respuesta.
  const warnings = validatePlan(plan, { objective: block.objective, ftp: user.ftp, pvo2maxWatts: user.pvo2maxWatts });

  const created: string[] = [];
  const skipped: string[] = [];

  for (const day of plan) {
    if (opts?.fromDate && day.date < opts.fromDate) continue;
    const key = dateKeyLocal(day.date);
    // Modo "regenerar esta sesión": solo ese día, y reemplaza la sesión existente (si no está completada)
    if (opts?.replaceDate && key !== dateKeyLocal(opts.replaceDate)) continue;
    try {
      const existing = await prisma.generatedWorkout.findFirst({
        where: {
          athleteId: block.athleteId,
          date: { gte: day.date, lt: new Date(day.date.getTime() + 86400000) },
          // Cualquier estado: si ya hay una sesión aprobada/editada/enviada ese día, no se duplica
        },
      });
      if (existing && opts?.replaceDate && existing.status !== "COMPLETED") {
        const wasConfirmed = ["APPROVED", "EDITED", "SENT_TO_INTERVALS"].includes(existing.status);
        await prisma.generatedWorkout.update({
          where: { id: existing.id },
          data: {
            workoutLibraryKey: day.stimulusType,
            // Si ya estaba aprobada/enviada queda aprobada, lista para (re)enviar a Intervals
            status: wasConfirmed ? "APPROVED" : "PLANNED",
            sentToIntervalsAt: null,
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
        continue;
      }
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
