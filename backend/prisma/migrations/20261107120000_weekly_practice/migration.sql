-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "audioAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "criteria" JSONB,
ADD COLUMN     "dueOn" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'assessment',
ADD COLUMN     "media" TEXT NOT NULL DEFAULT 'audio',
ADD COLUMN     "monthId" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewCheckpoint" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "support" TEXT,
ADD COLUMN     "targetSpeed" INTEGER,
ADD COLUMN     "week" INTEGER;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "marks" JSONB,
ADD COLUMN     "media" TEXT NOT NULL DEFAULT 'audio',
ADD COLUMN     "priorities" JSONB,
ADD COLUMN     "recordingSize" INTEGER,
ADD COLUMN     "recordingType" TEXT,
ADD COLUMN     "speed" DOUBLE PRECISION,
ADD COLUMN     "support" TEXT;

-- CreateTable
CREATE TABLE "PracticeMonth" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT,
    "studentId" TEXT NOT NULL,
    "songId" TEXT,
    "startsOn" TEXT NOT NULL,
    "weekTitles" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingUpload" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "partSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RecordingUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticeMonth_studentId_idx" ON "PracticeMonth"("studentId");

-- CreateIndex
CREATE INDEX "PracticeMonth_teacherId_idx" ON "PracticeMonth"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingUpload_key_key" ON "RecordingUpload"("key");

-- CreateIndex
CREATE INDEX "RecordingUpload_assignmentId_idx" ON "RecordingUpload"("assignmentId");

-- CreateIndex
CREATE INDEX "Assignment_monthId_idx" ON "Assignment"("monthId");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "PracticeMonth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeMonth" ADD CONSTRAINT "PracticeMonth_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeMonth" ADD CONSTRAINT "PracticeMonth_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeMonth" ADD CONSTRAINT "PracticeMonth_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingUpload" ADD CONSTRAINT "RecordingUpload_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

