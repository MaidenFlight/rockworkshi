import { API_URL } from "@/lib/api";
import { uploadVideo } from "@/lib/video/upload";

// Shared by the /teacher pages.

export async function teacherRequest(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const STATUS_LABELS = {
  assigned: "Practising",
  saved: "Checkpoint saved",
  ready: "Ready for review",
  reviewed: "Reviewed",
};

export function contentTitle(assignment) {
  const item = assignment.song || assignment.lesson;
  if (!item) return "Removed song or lesson";
  return item.artist ? `${item.title} · ${item.artist}` : item.title;
}

// The student's side: a title without the artist, which gets its own line, and what each
// status means from where they sit.
export function assignmentTitle(assignment) {
  return (assignment.song || assignment.lesson)?.title ?? "Removed song or lesson";
}

export function studentStatus(assignment) {
  // A weekly assessment is something the student submits on purpose, so it says so.
  const assessment = assignment.kind === "assessment" && Boolean(assignment.week);
  if (assignment.status === "saved") return { label: "Saved", tone: "open" };
  if (assignment.status === "ready") return { label: assessment ? "Submitted" : "Waiting for your teacher", tone: "ready" };
  if (assignment.status === "reviewed") return { label: assessment ? "Reviewed" : "Feedback ready", tone: "open" };
  return { label: assessment ? "Not submitted" : "To practise", tone: "draft" };
}

export function hasLoop(assignment) {
  return assignment.sectionStart !== null && assignment.sectionEnd !== null;
}

// XMLHttpRequest because fetch can't report upload progress.
function uploadRecording(assignmentId, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${API_URL}/assignments/${assignmentId}/recording`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", "audio/wav");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onerror = () => reject(new Error("The recording didn't upload. Check your connection and try again."));
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // Not JSON, so the status below speaks for it.
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data.key);
      else reject(new Error(data.error || `The recording didn't upload (${xhr.status}). Try again.`));
    };
    xhr.send(blob);
  });
}

// Sends the work: for review, or saved as a checkpoint. A take is { blob, offset, duration, speed,
// support } and is uploaded first.
export async function sendForReview(assignmentId, take, onProgress) {
  let recording;
  if (take) {
    const key = await uploadRecording(assignmentId, take.blob, onProgress);
    recording = { key, offset: take.offset, duration: take.duration, speed: take.speed, support: take.support };
  }
  await teacherRequest(`/assignments/${assignmentId}/submit`, {
    method: "POST",
    body: JSON.stringify(recording ? { recording } : {}),
  });
}

// Sends a video take. It's uploaded in pieces and can pick up where an earlier try stopped, then sent
// as one send like any other. video = { blob, offset, duration, speed, support, uploadId, onStarted }.
export async function sendVideoForReview(assignmentId, video, onProgress) {
  const key = await uploadVideo(assignmentId, video.blob, { uploadId: video.uploadId, duration: video.duration, onStarted: video.onStarted, onProgress });
  await teacherRequest(`/assignments/${assignmentId}/submit`, {
    method: "POST",
    body: JSON.stringify({ recording: { key, offset: video.offset, duration: video.duration, speed: video.speed, support: video.support } }),
  });
}

// Which stem belongs to an instrument. Mirrors INSTRUMENT_PARTS in backend/src/lib/instrumentAccess.js.
// Ukulele has its own stem only where one was uploaded; the guitar never stands in for it.
const PART_FOR_INSTRUMENT = {
  Guitar: "Guitar",
  Ukulele: "Ukulele",
  Piano: "Keys",
  Bass: "Bass",
  Drums: "Drums",
  Voice: "Vocals",
};

export function partForInstrument(instrument) {
  return PART_FOR_INSTRUMENT[instrument] || null;
}

export function studentName(student) {
  return student?.name || "Unnamed student";
}

// "1:05" -> 65. Plain seconds ("65") work too. Returns null for blank, NaN for nonsense.
export function parseClock(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  const m = /^(\d+):([0-5]\d)(\.\d+)?$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]) + Number(m[3] || 0);
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

export function formatClock(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "";
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
