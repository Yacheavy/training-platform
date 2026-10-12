-- Consumo de IA fuera del chat (análisis enviados por mail), para que entre en el contador de tokens y dinero
CREATE TABLE IF NOT EXISTS "AiUsageEvent" (
  "id" TEXT NOT NULL,
  "athleteId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "activityId" TEXT,
  "inputTokens" INTEGER NOT NULL,
  "outputTokens" INTEGER NOT NULL,
  "costUsd" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiUsageEvent_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AiUsageEvent_athleteId_createdAt_idx" ON "AiUsageEvent"("athleteId", "createdAt");
