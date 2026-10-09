-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailAnalysis" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "analysisEmailSentAt" TIMESTAMP(3);
