-- AlterTable
ALTER TABLE "vocabulary" ADD COLUMN "lesson" INTEGER;

-- CreateIndex
CREATE INDEX "vocabulary_lesson_idx" ON "vocabulary"("lesson");
