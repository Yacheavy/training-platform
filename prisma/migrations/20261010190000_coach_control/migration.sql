-- Control del entrenador sobre la planificación de sus alumnos
ALTER TABLE "AthleteGoal" ADD COLUMN IF NOT EXISTS "createdByCoach" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coachPlanUpdatedAt" TIMESTAMP(3);
