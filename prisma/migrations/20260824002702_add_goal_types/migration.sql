-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('EVENT', 'PERFORMANCE');

-- AlterTable
ALTER TABLE "AthleteGoal" ADD COLUMN     "baselineValue" DOUBLE PRECISION,
ADD COLUMN     "goalType" "GoalType" NOT NULL DEFAULT 'EVENT',
ADD COLUMN     "metric" TEXT,
ADD COLUMN     "targetValue" DOUBLE PRECISION;
