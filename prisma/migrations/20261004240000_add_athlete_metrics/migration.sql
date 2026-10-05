-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pvo2maxSource" TEXT,
ADD COLUMN     "lthr" INTEGER,
ADD COLUMN     "maxHr" INTEGER,
ADD COLUMN     "powerCurveJson" JSONB,
ADD COLUMN     "powerCurveSyncedAt" TIMESTAMP(3),
ADD COLUMN     "sportSettingsJson" JSONB;
