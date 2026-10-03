/*
  Warnings:

  - You are about to drop the `Athlete` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "Athlete" DROP CONSTRAINT "Athlete_coachId_fkey";

-- DropForeignKey
ALTER TABLE "AthleteBaseline" DROP CONSTRAINT "AthleteBaseline_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "AthleteGoal" DROP CONSTRAINT "AthleteGoal_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "AthleteResponseProfile" DROP CONSTRAINT "AthleteResponseProfile_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "AthleteThresholds" DROP CONSTRAINT "AthleteThresholds_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "DailyCheckin" DROP CONSTRAINT "DailyCheckin_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "DataSource" DROP CONSTRAINT "DataSource_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "GeneratedWorkout" DROP CONSTRAINT "GeneratedWorkout_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "TrainingBlock" DROP CONSTRAINT "TrainingBlock_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "TrainingTemplateSlot" DROP CONSTRAINT "TrainingTemplateSlot_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "WeeklyReview" DROP CONSTRAINT "WeeklyReview_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "Wellness" DROP CONSTRAINT "Wellness_athleteId_fkey";

-- DropTable
DROP TABLE "Athlete";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coachId" TEXT,
    "intervalsAthleteId" TEXT,
    "intervalsApiKeyEncrypted" TEXT,
    "intervalsLastSyncAt" TIMESTAMP(3),
    "intervalsFullHistorySyncedAt" TIMESTAMP(3),
    "weight" DOUBLE PRECISION,
    "ftp" INTEGER,
    "ftpUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSource" ADD CONSTRAINT "DataSource_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wellness" ADD CONSTRAINT "Wellness_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCheckin" ADD CONSTRAINT "DailyCheckin_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingTemplateSlot" ADD CONSTRAINT "TrainingTemplateSlot_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteGoal" ADD CONSTRAINT "AthleteGoal_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteThresholds" ADD CONSTRAINT "AthleteThresholds_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteBaseline" ADD CONSTRAINT "AthleteBaseline_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteResponseProfile" ADD CONSTRAINT "AthleteResponseProfile_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingBlock" ADD CONSTRAINT "TrainingBlock_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedWorkout" ADD CONSTRAINT "GeneratedWorkout_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
