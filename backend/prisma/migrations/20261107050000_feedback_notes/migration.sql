-- The teacher's notes tied to moments in the song, saved with their feedback on a submission
-- (lib/assignments.js validateNotes). Nullable: submissions from before have none.
-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "notes" JSONB;
