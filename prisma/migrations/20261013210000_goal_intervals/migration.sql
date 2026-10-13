-- Carreras y objetivos de rendimiento enviados a Intervals como eventos
ALTER TABLE "AthleteGoal" ADD COLUMN IF NOT EXISTS "intervalsSentAt" TIMESTAMP(3);
