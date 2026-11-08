// Recording a video take in the browser: which format to ask for, the limits, and what to say when the
// camera won't open. The limits match the API's (backend lib/assignments.js).

export const VIDEO_BITRATE = 2_500_000;
export const AUDIO_BITRATE = 128_000;
export const MAX_VIDEO_SECONDS = 8 * 60;
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
// How long before the limit the student is told recording is about to stop.
export const WARN_SECONDS = 30;

// MP4 first: it plays in every browser, where WebM from one browser may not play in another.
const FORMATS = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

// The format to record in, given a test for what this browser can do, or null if it can't do any.
export function pickVideoFormat(isSupported) {
  return FORMATS.find((type) => isSupported(type)) ?? null;
}

// Whether this browser can record a video at all.
export function canRecordVideo() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return false;
  return Boolean(pickVideoFormat((type) => MediaRecorder.isTypeSupported(type)));
}

// Echo cancellation and noise suppression are tuned for calls and mangle instruments.
export function micConstraints(micId) {
  return { echoCancellation: false, noiseSuppression: false, autoGainControl: false, ...(micId ? { deviceId: { ideal: micId } } : {}) };
}

export function cameraConstraints(micId) {
  return { video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: "user" }, audio: micConstraints(micId) };
}

export function cameraProblem(err) {
  if (err?.name === "NotAllowedError") return "The camera or microphone was blocked. Allow them in your browser's site settings and try again.";
  if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") return "No camera was found on this device.";
  if (err?.name === "NotReadableError") return "The camera is being used by something else. Close that and try again.";
  return "The camera wouldn't open. Try again, or try another browser.";
}
