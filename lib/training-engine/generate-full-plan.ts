import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma";
import { buildPlan, PlanLibraryEntry } from "./plan-builder";
import { validatePlan } from "./plan-validator";
import { dateKeyLocal } from "../tz";
import { loadAutoregulation } from "@/lib/autoregulation-data";
import { adaptForIndoor } from "./indoor";
import { calculateTss, calculateKilojoules } from "./tss";
import { calculateFueling } from "./fueling";

export async function generateFullPlan(trainingBlockId: string, opts?: { fromDate?: Date; athleteId?: string; replaceDate?: Date; replaceAll?: boolean; excludeKeys?: string[] }) {
  const block = await prisma.trainingBlock.findUnique({ where: { id: trainingBlockId } });
  if (!block || (opts?.athleteId && block.athleteId !== opts.athleteId)) throw new Error("Bloque no encontrado");

  const user = await prisma.user.findUnique({ where: { id: block.athleteId } });
  if (!user?.ftp) throw new Error("Cargá tu FTP en Ajustes antes de generar un plan completo");

  const thresholds = await prisma.athleteThresholds.findUnique({ where: { athleteId: block.athleteId } });
  const template = await prisma.trainingTemplateSlot.findMany({ where: { athleteId: block.athleteId } });
  const libraryRows = await prisma.workoutLibraryEntry.findMany();
  const library: Record<string, PlanLibraryEntry> = Object.fromEntries(libraryRows.map((l) => [l.key, l]));

  // Historial para la rotación: sesiones de las 4 semanas previas al bloque y, al regenerar parcialmente,
  // las ya existentes dentro del bloque anteriores al día objetivo (así la simulación coincide con lo real).
  const DAY = 86400000;
  const startMs = block.startDate.getTime();
  const offsetOf = (d: Date) => Math.round((d.getTime() - startMs) / DAY);
  const isVariantRow = (k: string) => k !== "gym" && !k.startsWith("ftp_test");
  const prior = await prisma.generatedWorkout.findMany({
    where: { athleteId: block.athleteId, date: { gte: new Date(startMs - 28 * DAY), lt: block.startDate } },
    select: { date: true, workoutLibraryKey: true },
  });
  const history = prior.filter((r) => isVariantRow(r.workoutLibraryKey)).map((r) => ({ dayOffset: offsetOf(r.date), key: r.workoutLibraryKey }));
  const targetDate = opts?.replaceDate ?? opts?.fromDate;
  const fixedKeys: Record<number, string> = {};
  if (targetDate) {
    const inBlock = await prisma.generatedWorkout.findMany({
      where: { athleteId: block.athleteId, date: { gte: block.startDate, lt: targetDate } },
      select: { date: true, workoutLibraryKey: true },
    });
    for (const r of inBlock) if (isVariantRow(r.workoutLibraryKey)) fixedKeys[offsetOf(r.date)] = r.workoutLibraryKey;
  }
  const excludeByDate: Record<string, string[]> = opts?.replaceDate && opts.excludeKeys?.length ? { [dateKeyLocal(opts.replaceDate)]: opts.excludeKeys } : {};

  // Autorregulación: ejecución real de las últimas 8 semanas y distribución real de intensidad de 14 días
  const now = new Date();
  const { execution, guard } = await loadAutoregulation(block.athleteId, now);

  const plan = buildPlan({
    block: { name: block.name, objective: block.objective, startDate: block.startDate, endDate: block.endDate },
    ftp: user.ftp,
    pvo2maxWatts: user.pvo2maxWatts,
    thresholds: {
      deloadRatio: thresholds?.deloadRatio ?? "4:1",
      weeksBetweenFtpTest: thresholds?.weeksBetweenFtpTest ?? 5,
      ftpTestProtocol: thresholds?.ftpTestProtocol,
      vo2Stimulus: thresholds?.vo2Stimulus,
      varietyLevel: thresholds?.varietyLevel,
      bannedStimuli: thresholds?.bannedStimuli ?? [],
      periodization: thresholds?.periodization,
    },
    template,
    library,
    history,
    fixedKeys,
    excludeByDate,
    execution,
    guard,
    guardUntilOffset: offsetOf(now) + (guard?.days ?? 0),
  });

  // Red de seguridad: si el plan viola una regla del protocolo se avisa en la respuesta.
  const warnings = validatePlan(plan, { objective: block.objective, ftp: user.ftp, pvo2maxWatts: user.pvo2maxWatts, banned: thresholds?.bannedStimuli ?? [] });

  const created: string[] = [];
  const skipped: string[] = [];
  const resendIds: string[] = [];

  for (const day of plan) {
    if (opts?.fromDate && day.date < opts.fromDate) continue;
    const key = dateKeyLocal(day.date);
    // Modo "regenerar esta sesión": solo ese día, y reemplaza la sesión existente (si no está completada)
    if (opts?.replaceDate && key !== dateKeyLocal(opts.replaceDate)) continue;
    const replacing = !!opts?.replaceDate || !!opts?.replaceAll;
    try {
      const existing = await prisma.generatedWorkout.findFirst({
        where: {
          athleteId: block.athleteId,
          date: { gte: day.date, lt: new Date(day.date.getTime() + 86400000) },
          // Cualquier estado: si ya hay una sesión aprobada/editada/enviada ese día, no se duplica
        },
      });
      if (existing && replacing && existing.status !== "COMPLETED" && !(opts?.replaceAll && !opts?.replaceDate && existing.status === "EDITED")) {
        const wasSent = existing.status === "SENT_TO_INTERVALS";
        const wasConfirmed = ["APPROVED", "EDITED", "SENT_TO_INTERVALS"].includes(existing.status);
        // Regenerar el PLAN respeta que el día se pasó a rodillo (una restricción real, p. ej. lluvia); regenerar UNA sesión vuelve a ruta a propósito
        const keepIndoor = existing.environment === "indoor" && !opts?.replaceDate && day.stimulusType !== "gym";
        const ind = keepIndoor ? adaptForIndoor(day.blocks, day.stimulusType) : null;
        const outBlocks = ind ? ind.blocks : day.blocks;
        const outFuel = ind ? calculateFueling(ind.blocks, user.ftp) : day.fueling;
        await prisma.generatedWorkout.update({
          where: { id: existing.id },
          data: {
            workoutLibraryKey: day.stimulusType,
            // Si ya estaba aprobada/enviada queda aprobada, lista para (re)enviar a Intervals
            status: wasConfirmed ? "APPROVED" : "PLANNED",
            sentToIntervalsAt: null,
            blocksJson: outBlocks as unknown as Prisma.InputJsonValue,
            estimatedTss: ind ? calculateTss(ind.blocks, user.ftp) : day.tss,
            estimatedKj: ind ? calculateKilojoules(ind.blocks) : day.fueling.totalKj,
            suggestedCarbsG: outFuel.suggestedCarbsG,
            suggestedCarbsGPerHour: outFuel.suggestedCarbsGPerHour,
            requiresMultipleCarbSources: outFuel.requiresMultipleCarbSources,
            rationale: ind ? `${day.rationale} · ${ind.note}` : day.rationale,
            environment: ind ? "indoor" : "road",
          },
        });
        created.push(key);
        if (wasSent) resendIds.push(existing.id);
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

  return { created: created.length, skipped: skipped.length, createdDates: created, skippedDates: skipped, warnings, resendIds };
}
