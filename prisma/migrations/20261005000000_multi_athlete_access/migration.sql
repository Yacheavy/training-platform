-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'ATHLETE';

-- CreateTable
CREATE TABLE "AllowedEmail" (
    "email" TEXT NOT NULL,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllowedEmail_pkey" PRIMARY KEY ("email")
);

-- DropIndex
DROP INDEX IF EXISTS "Wellness_date_key";
DROP INDEX IF EXISTS "DailyCheckin_date_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Wellness_athleteId_date_key" ON "Wellness"("athleteId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "DailyCheckin_athleteId_date_key" ON "DailyCheckin"("athleteId", "date");
