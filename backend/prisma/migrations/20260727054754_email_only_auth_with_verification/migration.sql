/*
  Warnings:

  - You are about to drop the column `googleId` on the `User` table. All the data in the column will be lost.
  - Made the column `passwordHash` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "User_googleId_key";

-- AlterTable
-- The SET NOT NULL below fails if any account has no password — which would
-- mean an OAuth-only user. Give those a password (or remove them) before
-- migrating rather than inventing one here.
ALTER TABLE "User" DROP COLUMN "googleId",
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "verificationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "verificationSentAt" TIMESTAMP(3),
ADD COLUMN     "verificationTokenHash" TEXT,
ALTER COLUMN "passwordHash" SET NOT NULL;

-- Accounts created before verification existed are treated as already
-- verified. Without this they'd be held at the "check your inbox" step with no
-- token to get past it.
UPDATE "User" SET "emailVerifiedAt" = CURRENT_TIMESTAMP WHERE "emailVerifiedAt" IS NULL;
