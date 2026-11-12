-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "planTaskId" TEXT;

-- AlterTable
ALTER TABLE "PracticeMonth" ADD COLUMN     "planId" TEXT,
ADD COLUMN     "planVersion" INTEGER;

-- CreateTable
CREATE TABLE "MonthPlan" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "songId" TEXT,
    "startsOn" TEXT,
    "classId" TEXT,
    "weekTitles" JSONB NOT NULL,
    "tasks" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthPlanStudent" (
    "planId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "overrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthPlanStudent_pkey" PRIMARY KEY ("planId","studentId")
);

-- CreateTable
CREATE TABLE "MonthPlanVersion" (
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "startsOn" TEXT,
    "weekTitles" JSONB NOT NULL,
    "tasks" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthPlanVersion_pkey" PRIMARY KEY ("planId","version")
);

-- CreateIndex
CREATE INDEX "MonthPlan_teacherId_kind_idx" ON "MonthPlan"("teacherId", "kind");

-- CreateIndex
CREATE INDEX "MonthPlan_templateId_idx" ON "MonthPlan"("templateId");

-- CreateIndex
CREATE INDEX "MonthPlanStudent_studentId_idx" ON "MonthPlanStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeMonth_planId_studentId_key" ON "PracticeMonth"("planId", "studentId");

-- AddForeignKey
ALTER TABLE "PracticeMonth" ADD CONSTRAINT "PracticeMonth_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MonthPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthPlan" ADD CONSTRAINT "MonthPlan_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthPlan" ADD CONSTRAINT "MonthPlan_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthPlan" ADD CONSTRAINT "MonthPlan_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthPlan" ADD CONSTRAINT "MonthPlan_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MonthPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthPlanStudent" ADD CONSTRAINT "MonthPlanStudent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MonthPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthPlanStudent" ADD CONSTRAINT "MonthPlanStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthPlanVersion" ADD CONSTRAINT "MonthPlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MonthPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

