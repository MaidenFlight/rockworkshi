import { api } from "@/lib/api";
import { deleteSavedTake, SavedTake, takeFile } from "@/lib/takes";

// Shapes returned by the API's /assignments routes (backend/src/lib/assignments.js).

export type Submission = {
  id: string;
  createdAt: string;
  recording: { offset: number | null; duration: number | null; url?: string } | null;
  feedback: string | null;
  reviewedAt: string | null;
};

export type Assignment = {
  id: string;
  status: "assigned" | "ready" | "reviewed";
  instrument: string;
  level: number;
  levelName: string | null;
  section: string | null;
  sectionStart: number | null;
  sectionEnd: number | null;
  instruction: string;
  createdAt: string;
  song: { id: string; title: string; artist: string | null } | null;
  lesson: { id: string; title: string; artist: string | null } | null;
  teacher: { id: string; name: string | null } | null;
  submissions: Submission[]; // newest first
};

export function statusLabel(a: Assignment) {
  if (a.status === "ready") return "Waiting for your teacher";
  if (a.status === "reviewed") return "Feedback ready";
  return "To practise";
}

export function assignmentTitle(a: Assignment) {
  return (a.song || a.lesson)?.title ?? "Removed song or lesson";
}

export function hasLoop(a: Assignment): a is Assignment & { sectionStart: number; sectionEnd: number } {
  return a.sectionStart !== null && a.sectionEnd !== null;
}

// Marks the assignment ready for review. With a take, uploads it first through a
// short-lived link from the API, straight to private storage.
export async function sendForReview(
  assignmentId: string,
  take: SavedTake | null,
  onProgress?: (fraction: number) => void
) {
  let recording;
  if (take) {
    const { key, uploadUrl, contentType } = await api(`/assignments/${assignmentId}/recording-upload`, {
      method: "POST",
      body: JSON.stringify({ size: take.size }),
    });
    const result = await takeFile(take).upload(uploadUrl, {
      httpMethod: "PUT",
      headers: { "Content-Type": contentType },
      onProgress: ({ bytesSent, totalBytes }) => onProgress?.(totalBytes ? bytesSent / totalBytes : 0),
    });
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`The recording didn't upload (${result.status}). Try again.`);
    }
    recording = { key, offset: take.offset, duration: take.duration };
  }

  await api(`/assignments/${assignmentId}/submit`, {
    method: "POST",
    body: JSON.stringify(recording ? { recording } : {}),
  });
  // It's stored privately now, so the phone's copy can go.
  if (take) deleteSavedTake(assignmentId);
}
