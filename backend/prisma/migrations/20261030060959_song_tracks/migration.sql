-- CreateTable
CREATE TABLE "SongTrack" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "part" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SongTrack_songId_idx" ON "SongTrack"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "SongTrack_songId_part_key" ON "SongTrack"("songId", "part");

-- AddForeignKey
ALTER TABLE "SongTrack" ADD CONSTRAINT "SongTrack_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
