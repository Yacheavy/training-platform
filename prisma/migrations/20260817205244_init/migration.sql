-- CreateEnum
CREATE TYPE "DeviationFlag" AS ENUM ('NONE', 'HARDER_THAN_PLANNED', 'EASIER_THAN_PLANNED');

-- CreateEnum
CREATE TYPE "GoalPriority" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "FidelityStatus" AS ENUM ('GREEN', 'AMBER', 'RED');

-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('SUGGESTED', 'EDITED', 'APPROVED', 'SENT_TO_INTERVALS', 'COMPLETED');

-- CreateTable
CREATE TABLE "Athlete" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coachId" TEXT,
    "intervalsAthleteId" TEXT,
    "intervalsApiKeyEncrypted" TEXT,
    "intervalsLastSyncAt" TIMESTAMP(3),
    "intervalsFullHistorySyncedAt" TIMESTAMP(3),
    "weight" DOUBLE PRECISION,
    "ftp" INTEGER,
    "ftpUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldsAvailable" TEXT[],
    "isValidatedInstrument" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "intervalsActivityId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "distanceM" DOUBLE PRECISION,
    "avgPower" DOUBLE PRECISION,
    "normalizedPower" DOUBLE PRECISION,
    "avgHr" DOUBLE PRECISION,
    "maxHr" DOUBLE PRECISION,
    "avgCadence" DOUBLE PRECISION,
    "kilojoules" DOUBLE PRECISION,
    "tss" DOUBLE PRECISION,
    "intensityFactor" DOUBLE PRECISION,
    "elevationGainM" DOUBLE PRECISION,
    "powerBalanceLeft" DOUBLE PRECISION,
    "decouplingPct" DOUBLE PRECISION,
    "generatedWorkoutId" TEXT,
    "plannedTss" DOUBLE PRECISION,
    "deviationFlag" "DeviationFlag" NOT NULL DEFAULT 'NONE',
    "deviationNotes" TEXT,
    "rawStreamsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wellness" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hrv" DOUBLE PRECISION,
    "restingHr" DOUBLE PRECISION,
    "sleepScore" DOUBLE PRECISION,
    "sleepHours" DOUBLE PRECISION,
    "steps" INTEGER,
    "spo2" DOUBLE PRECISION,
    "stressScore" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'intervals_sync',

    CONSTRAINT "Wellness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCheckin" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sleepQuality" INTEGER,
    "fatigue" INTEGER,
    "stress" INTEGER,
    "muscleSoreness" INTEGER,
    "mood" INTEGER,
    "freeText" TEXT,
    "aiSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingTemplateSlot" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "stimulusType" TEXT NOT NULL,
    "targetDurationMin" INTEGER,
    "appliesInPhases" TEXT[],

    CONSTRAINT "TrainingTemplateSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteGoal" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "priority" "GoalPriority" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "AthleteGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteThresholds" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "maxCtlRampPerWeek" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "hrvDropAlertPct" DOUBLE PRECISION NOT NULL DEFAULT 7.5,
    "minTsb" DOUBLE PRECISION NOT NULL DEFAULT -25,
    "maxConsecutiveBadSleepDays" INTEGER NOT NULL DEFAULT 2,
    "weeksBetweenFtpTest" INTEGER NOT NULL DEFAULT 5,
    "deloadRatio" TEXT NOT NULL DEFAULT '4:1',

    CONSTRAINT "AthleteThresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteBaseline" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "calibrationStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calibrationComplete" BOOLEAN NOT NULL DEFAULT false,
    "hrvMean7d" DOUBLE PRECISION,
    "hrvCV" DOUBLE PRECISION,
    "hrvSWC" DOUBLE PRECISION,
    "restingHrMean" DOUBLE PRECISION,
    "restingHrSD" DOUBLE PRECISION,
    "lastRecalculatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteResponseProfile" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "stimulusType" TEXT NOT NULL,
    "avgHrvImpactNextDayPct" DOUBLE PRECISION,
    "avgRecoveryHours" DOUBLE PRECISION,
    "sessionsCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteResponseProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingBlock" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "plannedWeeklyTssProgression" JSONB NOT NULL,

    CONSTRAINT "TrainingBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "trainingBlockId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "plannedTss" DOUBLE PRECISION NOT NULL,
    "actualTss" DOUBLE PRECISION NOT NULL,
    "fidelityIndexPct" DOUBLE PRECISION NOT NULL,
    "fidelityStatus" "FidelityStatus" NOT NULL,
    "adjustmentsApplied" TEXT,
    "escalatedToAthlete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutLibraryEntry" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intensityPctFtpLow" DOUBLE PRECISION,
    "intensityPctFtpHigh" DOUBLE PRECISION,
    "maxSessionsPerWeek" INTEGER,
    "evidenceSource" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "WorkoutLibraryEntry_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "GeneratedWorkout" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "workoutLibraryKey" TEXT NOT NULL,
    "status" "WorkoutStatus" NOT NULL DEFAULT 'SUGGESTED',
    "blocksJson" JSONB NOT NULL,
    "estimatedTss" DOUBLE PRECISION,
    "estimatedKj" DOUBLE PRECISION,
    "suggestedCarbsG" DOUBLE PRECISION,
    "suggestedCarbsGPerHour" DOUBLE PRECISION,
    "requiresMultipleCarbSources" BOOLEAN NOT NULL DEFAULT false,
    "rationale" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentToIntervalsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "focusedEntityId" TEXT,
    "focusedEntityType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_email_key" ON "Athlete"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_intervalsActivityId_key" ON "Activity"("intervalsActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "Wellness_date_key" ON "Wellness"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCheckin_date_key" ON "DailyCheckin"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteThresholds_athleteId_key" ON "AthleteThresholds"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteBaseline_athleteId_key" ON "AthleteBaseline"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteResponseProfile_athleteId_stimulusType_key" ON "AthleteResponseProfile"("athleteId", "stimulusType");

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSource" ADD CONSTRAINT "DataSource_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_generatedWorkoutId_fkey" FOREIGN KEY ("generatedWorkoutId") REFERENCES "GeneratedWorkout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wellness" ADD CONSTRAINT "Wellness_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCheckin" ADD CONSTRAINT "DailyCheckin_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingTemplateSlot" ADD CONSTRAINT "TrainingTemplateSlot_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteGoal" ADD CONSTRAINT "AthleteGoal_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteThresholds" ADD CONSTRAINT "AthleteThresholds_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteBaseline" ADD CONSTRAINT "AthleteBaseline_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteResponseProfile" ADD CONSTRAINT "AthleteResponseProfile_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingBlock" ADD CONSTRAINT "TrainingBlock_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_trainingBlockId_fkey" FOREIGN KEY ("trainingBlockId") REFERENCES "TrainingBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedWorkout" ADD CONSTRAINT "GeneratedWorkout_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
