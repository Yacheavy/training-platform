-- Perfil de la prueba: adapta la activación de la víspera y el calentamiento del día de la carrera
ALTER TABLE "AthleteGoal" ADD COLUMN IF NOT EXISTS "courseProfile" TEXT;
