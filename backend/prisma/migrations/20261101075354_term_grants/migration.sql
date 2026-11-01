-- CreateTable
CREATE TABLE "TermGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "songId" TEXT,
    "lessonId" TEXT,
    "groupId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TermGrant_userId_songId_key" ON "TermGrant"("userId", "songId");

-- CreateIndex
CREATE UNIQUE INDEX "TermGrant_userId_lessonId_key" ON "TermGrant"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "TermGrant" ADD CONSTRAINT "TermGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermGrant" ADD CONSTRAINT "TermGrant_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermGrant" ADD CONSTRAINT "TermGrant_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
