-- Student demo accounts (lib/demo.js). Null on every real account.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "demoExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_demoExpiresAt_idx" ON "User"("demoExpiresAt");
