-- CreateTable
CREATE TABLE "TermGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermSlot" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "unlockAt" TIMESTAMP(3) NOT NULL,
    "songId" TEXT,
    "lessonId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermEnrollment" (
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermEnrollment_pkey" PRIMARY KEY ("userId","groupId")
);

-- CreateIndex
CREATE INDEX "TermSlot_songId_idx" ON "TermSlot"("songId");

-- CreateIndex
CREATE INDEX "TermSlot_lessonId_idx" ON "TermSlot"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "TermSlot_groupId_month_key" ON "TermSlot"("groupId", "month");

-- CreateIndex
CREATE INDEX "TermEnrollment_groupId_idx" ON "TermEnrollment"("groupId");

-- AddForeignKey
ALTER TABLE "TermSlot" ADD CONSTRAINT "TermSlot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TermGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermSlot" ADD CONSTRAINT "TermSlot_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermSlot" ADD CONSTRAINT "TermSlot_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermEnrollment" ADD CONSTRAINT "TermEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermEnrollment" ADD CONSTRAINT "TermEnrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TermGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
