-- CreateTable
CREATE TABLE "SongMix" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "without" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "gain" DOUBLE PRECISION NOT NULL,
    "sources" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongMix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SongMix_songId_without_key" ON "SongMix"("songId", "without");

-- AddForeignKey
ALTER TABLE "SongMix" ADD CONSTRAINT "SongMix_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
