import { BANNABLE_KEYS } from "@/lib/training-engine/variants";
import { pushGoalsToIntervals, removeGoalFromIntervals } from "@/lib/push-goals";
import { prisma } from "@/lib/prisma";
import { normalizeCourseProfile } from "@/lib/training-engine/race-week";

/**
 * Núcleos de los ajustes de planificación. NO son acciones de servidor: reciben el id del alumno ya autorizado
 * (el propio usuario en settings-actions, o el entrenador de ese alumno en coach-actions).
 */

export async function saveTemplateCore(athleteId: string, formData: FormData) {

  const rows = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
    const type = String(formData.get(`type_${dayOfWeek}`) ?? "rest");
    const stimulusType = ["cycling", "gym", "flexibility", "rest"].includes(type) ? type : "rest";
    const isQualityDay = stimulusType === "cycling" && formData.get(`quality_${dayOfWeek}`) === "on";
    const rawMin = Number(formData.get(`min_${dayOfWeek}`));
    const targetDurationMin =
      stimulusType === "rest" ? null : Number.isFinite(rawMin) && rawMin >= 15 && rawMin <= 600 ? Math.round(rawMin) : null;
    if (stimulusType === "cycling" && targetDurationMin == null) {
      throw new Error("Cada día de ciclismo necesita una duración entre 15 y 600 minutos");
    }
    return { dayOfWeek, stimulusType, isQualityDay, targetDurationMin };
  });

  await prisma.$transaction(
    rows.map((r) =>
      prisma.trainingTemplateSlot.upsert({
        where: { athleteId_dayOfWeek: { athleteId, dayOfWeek: r.dayOfWeek } },
        update: { stimulusType: r.stimulusType, isQualityDay: r.isQualityDay, targetDurationMin: r.targetDurationMin },
        create: { athleteId, ...r, appliesInPhases: [] },
      })
    )
  );
}

export async function saveThresholdsCore(athleteId: string, formData: FormData) {

  // Un campo vacío NO debe guardarse como 0 (Number("") === 0): se ignora y queda el valor actual
  const num = (name: string, min: number, max: number): number | undefined => {
    const raw = formData.get(name);
    if (raw == null || String(raw).trim() === "") return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max) return undefined;
    return n;
  };
  const str = (name: string, allowed: string[]): string | undefined => {
    const v = String(formData.get(name) ?? "");
    return allowed.includes(v) ? v : undefined;
  };

  const data = {
    maxCtlRampPerWeek: num("maxCtlRampPerWeek", 1, 20),
    hrvDropAlertPct: num("hrvDropAlertPct", 1, 50),
    minTsb: num("minTsb", -60, 0),
    maxConsecutiveBadSleepDays: num("maxConsecutiveBadSleepDays", 1, 14),
    weeksBetweenFtpTest: num("weeksBetweenFtpTest", 0, 26),
    ftpTestProtocol: str("ftpTestProtocol", ["20min", "8min", "5min"]),
    vo2Stimulus: str("vo2Stimulus", ["hiit_genuino", "ronnestad_30_15", "alternate", "rotate"]),
    varietyLevel: str("varietyLevel", ["conservative", "balanced", "varied"]),
    periodization: str("periodization", ["linear", "block"]),
    contrastMode: formData.has("_gym") ? str("contrastMode", ["off", "tradicional", "frances"]) : undefined,
    flexibilityEnabled: formData.has("_gym") ? formData.get("flexibilityEnabled") === "on" : undefined,
    bannedStimuli: !formData.has("_planner") ? undefined : formData.getAll("banned").map(String).filter((k) => BANNABLE_KEYS.includes(k)),
    deloadRatio: /^[2-6]:1$/.test(String(formData.get("deloadRatio") ?? "").trim())
      ? String(formData.get("deloadRatio")).trim()
      : undefined,
  };

  await prisma.athleteThresholds.upsert({
    where: { athleteId },
    update: data,
    create: { athleteId, ...data },
  });
}

export async function addGoalCore(athleteId: string, formData: FormData, byCoach = false) {
  const eventDateStr = String(formData.get("eventDate") ?? "");
  const goalType = String(formData.get("goalType")) === "PERFORMANCE" ? "PERFORMANCE" : "EVENT";
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) throw new Error("Poné un nombre para el objetivo");
  if (goalType === "EVENT" && !/^\d{4}-\d{2}-\d{2}$/.test(eventDateStr)) throw new Error("Elegí la fecha del evento");
  const priority = ["A", "B", "C"].includes(String(formData.get("priority"))) ? (String(formData.get("priority")) as "A" | "B" | "C") : "B";

  const created = await prisma.athleteGoal.create({
    data: {
      athleteId,
      createdByCoach: byCoach,
      goalType,
      name,
      eventDate: /^\d{4}-\d{2}-\d{2}$/.test(eventDateStr) ? new Date(eventDateStr) : null,
      priority,
      courseProfile: goalType === "EVENT" ? normalizeCourseProfile(formData.get("courseProfile")) : null,
      metric: goalType === "PERFORMANCE" ? String(formData.get("metric") || "") || null : null,
      baselineValue: goalType === "PERFORMANCE" && formData.get("baselineValue") ? Number(formData.get("baselineValue")) : null,
      targetValue: goalType === "PERFORMANCE" && formData.get("targetValue") ? Number(formData.get("targetValue")) : null,
    },
  });
  void created;
  // Se envía a Intervals (carrera o nota); si falla no se pierde el objetivo: queda pendiente y se reintenta al sincronizar
  await pushGoalsToIntervals(athleteId).catch((e) => console.error("No se pudo enviar el objetivo a Intervals", e));
}

export async function deleteGoalCore(athleteId: string, formData: FormData) {
  const id = String(formData.get("id"));
  // Solo se puede borrar un objetivo propio
  const goal = await prisma.athleteGoal.findFirst({ where: { id, athleteId }, select: { id: true, eventDate: true, intervalsSentAt: true } });
  await prisma.athleteGoal.deleteMany({ where: { id, athleteId } });
  if (goal) await removeGoalFromIntervals(athleteId, goal).catch((e) => console.error("No se pudo quitar el objetivo de Intervals", e));
}

/** Cambia el perfil de la prueba de un evento propio (vacío = genérico). Solo aplica a eventos; se nota al regenerar el plan. */
export async function updateGoalProfileCore(athleteId: string, formData: FormData) {
  const id = String(formData.get("id"));
  const raw = String(formData.get("courseProfile") ?? "");
  const courseProfile = normalizeCourseProfile(raw);
  if (raw !== "" && !courseProfile) throw new Error("Perfil de prueba no válido");
  await prisma.athleteGoal.updateMany({ where: { id, athleteId, goalType: "EVENT" }, data: { courseProfile } });
}
