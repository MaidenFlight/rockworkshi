-- The student demo's passcode (lib/demo.js): one row, set by an admin. No row means the demo is closed.
-- CreateTable
CREATE TABLE "DemoAccess" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "passcodeHash" TEXT NOT NULL,
    "setBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoAccess_pkey" PRIMARY KEY ("id")
);
