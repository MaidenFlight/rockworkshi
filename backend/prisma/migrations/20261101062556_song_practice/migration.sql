-- CreateTable
CREATE TABLE "SongPractice" (
    "userId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "lastOpenedAt" TIMESTAMP(3),
    "session" JSONB,
    "sessionSavedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongPractice_pkey" PRIMARY KEY ("userId","songId")
);

-- CreateIndex
CREATE INDEX "SongPractice_userId_lastOpenedAt_idx" ON "SongPractice"("userId", "lastOpenedAt");

-- AddForeignKey
ALTER TABLE "SongPractice" ADD CONSTRAINT "SongPractice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongPractice" ADD CONSTRAINT "SongPractice_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
