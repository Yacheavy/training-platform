/*
  Warnings:

  - A unique constraint covering the columns `[athleteId,dayOfWeek]` on the table `TrainingTemplateSlot` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TrainingTemplateSlot_athleteId_dayOfWeek_key" ON "TrainingTemplateSlot"("athleteId", "dayOfWeek");
