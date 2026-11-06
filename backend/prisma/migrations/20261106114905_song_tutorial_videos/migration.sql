-- A song's video tutorials reuse LessonVideo: a row now belongs to a lesson or to a song.

-- AlterTable
ALTER TABLE "LessonVideo" ADD COLUMN     "songId" TEXT,
ALTER COLUMN "lessonId" DROP NOT NULL;

-- Exactly one owner, so a video can't float free or show up on a lesson and a song at once.
-- Prisma can't express this in the schema; every existing row has a lessonId and passes.
ALTER TABLE "LessonVideo" ADD CONSTRAINT "LessonVideo_one_owner_check" CHECK (("lessonId" IS NULL) <> ("songId" IS NULL));

-- CreateIndex
CREATE UNIQUE INDEX "LessonVideo_songId_instrument_level_kind_key" ON "LessonVideo"("songId", "instrument", "level", "kind");

-- AddForeignKey
ALTER TABLE "LessonVideo" ADD CONSTRAINT "LessonVideo_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
