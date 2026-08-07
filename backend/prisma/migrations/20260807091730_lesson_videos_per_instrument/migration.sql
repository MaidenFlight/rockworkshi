-- AlterTable
ALTER TABLE "Lesson" DROP COLUMN "playthroughVideoUrl",
DROP COLUMN "videoUrl";

-- CreateTable
CREATE TABLE "LessonVideo" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "kind" TEXT NOT NULL DEFAULT 'lesson',
    "provider" TEXT NOT NULL DEFAULT 'bunny',
    "videoId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonVideo_lessonId_idx" ON "LessonVideo"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonVideo_lessonId_instrument_level_kind_key" ON "LessonVideo"("lessonId", "instrument", "level", "kind");

-- AddForeignKey
ALTER TABLE "LessonVideo" ADD CONSTRAINT "LessonVideo_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

