-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentStateNote" TEXT,
ADD COLUMN     "currentStateUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "preferences" TEXT,
ADD COLUMN     "trainingBackground" TEXT;
