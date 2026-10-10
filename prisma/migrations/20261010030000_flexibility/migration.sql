-- Agrega un set de flexibilidad al final de las sesiones de gimnasio (opcional por alumno)
ALTER TABLE "AthleteThresholds" ADD COLUMN IF NOT EXISTS "flexibilityEnabled" BOOLEAN NOT NULL DEFAULT false;
