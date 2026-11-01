-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'student';

-- CreateTable
CREATE TABLE "TeacherStudent" (
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherStudent_pkey" PRIMARY KEY ("teacherId","studentId")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "songId" TEXT,
    "lessonId" TEXT,
    "instrument" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "section" TEXT,
    "sectionStart" DOUBLE PRECISION,
    "sectionEnd" DOUBLE PRECISION,
    "instruction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "recordingKey" TEXT,
    "recordingOffset" DOUBLE PRECISION,
    "recordingDuration" DOUBLE PRECISION,
    "feedback" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherStudent_studentId_idx" ON "TeacherStudent"("studentId");

-- CreateIndex
CREATE INDEX "Assignment_studentId_status_idx" ON "Assignment"("studentId", "status");

-- CreateIndex
CREATE INDEX "Assignment_teacherId_status_idx" ON "Assignment"("teacherId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_recordingKey_key" ON "Submission"("recordingKey");

-- CreateIndex
CREATE INDEX "Submission_assignmentId_idx" ON "Submission"("assignmentId");

-- AddForeignKey
ALTER TABLE "TeacherStudent" ADD CONSTRAINT "TeacherStudent_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherStudent" ADD CONSTRAINT "TeacherStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
