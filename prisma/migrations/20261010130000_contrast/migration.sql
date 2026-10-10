-- Entrenamiento de contraste (apagado por defecto)
ALTER TABLE "AthleteThresholds" ADD COLUMN IF NOT EXISTS "contrastMode" TEXT NOT NULL DEFAULT 'off';
