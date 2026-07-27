-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetSentAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT;
