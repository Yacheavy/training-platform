"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import type { Prisma } from "@/app/generated/prisma";
import { revalidatePath } from "next/cache";
import { dateKeyLocal } from "@/lib/tz";
import { calculateTss } from "@/lib/training-engine/tss";
import { calculateFueling } from "@/lib/training-engine/fueling";
import { pushWorkoutToIntervals } from "@/lib/push-workout";
import { getIntervalsCreds } from "@/lib/intervals-creds";
import { deleteEventByExternalId } from "@/lib/intervals-client";
import { loadSituationPlan, parseKind, parseTripDates } from "@/lib/situation-data";

const LABEL = { sick_neck: "enfermedad leve (de cuello para arriba)", sick_body: "enfermedad con síntomas generales", travel: "viaje" } as const;

/**
 * Aplica lo que mostró la vista previa de "¿Pasó algo?". Todo se recalcula en el servidor con los datos de ahora (el cliente solo manda
 * la situación y las fechas), y cada sesión que ya estaba en Intervals se actualiza o se borra allá también. Si una falla, se sigue con
 * las demás y se informa cuáles quedaron sin cambiar.
 */
export async function applySituation(formData: FormData): Promise<{ error: string } | { applied: number } | undefined> {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autenticado" };
  const athleteId = session.user.id;
  const kind = parseKind(formData.get("kind"));
  if (!kind) return { error: "Elegí qué pasó" };
  let trip: { from: string; to: string } | undefined;
  if (kind === "travel") {
    const t = parseTripDates(formData.get("from"), formData.get("to"), dateKeyLocal(new Date()));
    if ("error" in t) return { error: t.error };
    trip = t;
  }

  const loaded = await loadSituationPlan(athleteId, kind, trip);
  if ("error" in loaded) return { error: loaded.error };
  const { plan, ftp } = loaded;
  if (plan.changes.length === 0) return { error: "No hay sesiones para cambiar con esta situación" };

  const failed: string[] = [];
  let applied = 0;
  for (const c of plan.changes) {
    try {
      const w = await prisma.generatedWorkout.findUnique({ where: { id: c.workoutId } });
      if (!w || w.athleteId !== athleteId || w.status === "COMPLETED") continue;
      const inIntervals = w.status === "SENT_TO_INTERVALS";
      const confirmed = ["APPROVED", "EDITED", "SENT_TO_INTERVALS"].includes(w.status);

      if (c.kind === "rest") {
        if (inIntervals) {
          const creds = await getIntervalsCreds(athleteId);
          if (!creds) throw new Error("Sin conexión con Intervals");
          await deleteEventByExternalId(creds.athleteId, creds.apiKey, w.id, dateKeyLocal(new Date(w.date)));
        }
        await prisma.generatedWorkout.delete({ where: { id: w.id } });
        applied++;
      } else if (c.kind === "easy" && c.newBlocks && c.newKey) {
        const tss = calculateTss(c.newBlocks, ftp);
        const fueling = calculateFueling(c.newBlocks, ftp);
        await prisma.generatedWorkout.update({
          where: { id: w.id },
          data: {
            workoutLibraryKey: c.newKey,
            blocksJson: c.newBlocks as unknown as Prisma.InputJsonValue,
            estimatedTss: tss,
            estimatedKj: fueling.totalKj,
            suggestedCarbsG: fueling.suggestedCarbsG,
            suggestedCarbsGPerHour: fueling.suggestedCarbsGPerHour,
            requiresMultipleCarbSources: fueling.requiresMultipleCarbSources,
            rationale: `${w.rationale ?? ""} · Ajustada por ${LABEL[kind]}: ${c.reason}`,
            status: confirmed ? w.status : "EDITED",
          },
        });
        if (inIntervals) {
          try {
            await pushWorkoutToIntervals(athleteId, w.id);
          } catch (err) {
            // Si Intervals falla se revierte esa sesión: app e Intervals no deben quedar distintos
            await prisma.generatedWorkout.update({
              where: { id: w.id },
              data: {
                workoutLibraryKey: w.workoutLibraryKey,
                blocksJson: w.blocksJson as never,
                estimatedTss: w.estimatedTss,
                estimatedKj: w.estimatedKj,
                suggestedCarbsG: w.suggestedCarbsG,
                suggestedCarbsGPerHour: w.suggestedCarbsGPerHour,
                requiresMultipleCarbSources: w.requiresMultipleCarbSources,
                rationale: w.rationale,
                status: w.status,
              },
            });
            throw err;
          }
        }
        applied++;
      }
    } catch {
      failed.push(`${c.dayKey.slice(8)}/${c.dayKey.slice(5, 7)}`);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/planificacion");
  revalidatePath("/calendar");
  if (failed.length > 0) return { error: `Se aplicaron ${applied} cambios; no se pudieron cambiar las sesiones del ${failed.join(", ")} (Intervals no respondió). Probá de nuevo.` };
  return { applied };
}
