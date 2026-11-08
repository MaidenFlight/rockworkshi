// Sends a video up in pieces (the API's /assignments/:id/video-uploads). A piece that fails is tried
// again; if it still won't go, the upload stops and can be picked up later, even after a reload, sending
// only the pieces that haven't arrived. The video stays in the browser until the send has gone through.
import { API_URL } from "../api.js";

const RETRY_WAITS_MS = [1000, 3000];
const STOPPED = "The upload stopped part-way. Your video is still here: check your connection and press Resume upload to send the rest.";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The pieces still to send, in order.
export function missingParts(parts, received) {
  const have = new Set(received);
  return Array.from({ length: parts }, (_, i) => i + 1).filter((n) => !have.has(n));
}

// Where piece n sits in the file, as [start, end).
export function partBounds(n, partSize, size) {
  return [(n - 1) * partSize, Math.min(n * partSize, size)];
}

// Resolves with the stored file's key. uploadId picks up an earlier upload if the server still has it.
// onStarted(id) hears a new upload's id, to keep for later; onProgress(0..1) how much has arrived.
export async function uploadVideo(assignmentId, blob, { uploadId = null, duration = null, onStarted, onProgress, fetchFn = (...a) => fetch(...a), wait = sleep } = {}) {
  const base = `${API_URL}/assignments/${assignmentId}/video-uploads`;

  async function call(url, options = {}) {
    let res;
    try {
      res = await fetchFn(url, { credentials: "include", ...options });
    } catch {
      throw new Error(STOPPED);
    }
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || STOPPED);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function sendPart(id, n, piece) {
    for (let attempt = 0; ; attempt++) {
      try {
        await call(`${base}/${id}/parts/${n}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: piece });
        return;
      } catch (err) {
        // A refusal won't change by asking again; trouble with the connection or storage might.
        if ((err.status && err.status < 500) || attempt >= RETRY_WAITS_MS.length) throw err.status && err.status < 500 ? err : new Error(STOPPED);
        await wait(RETRY_WAITS_MS[attempt]);
      }
    }
  }

  let plan = null;
  if (uploadId) {
    try {
      plan = { ...(await call(`${base}/${uploadId}`)), id: uploadId };
    } catch (err) {
      // Gone (it was cancelled, or is over a day old): start again. Anything else is the connection.
      if (err.status !== 404) throw err;
    }
  }
  if (!plan) {
    plan = await call(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ size: blob.size, type: blob.type, duration }) });
    plan.received = [];
    onStarted?.(plan.id);
  }
  if (plan.complete) {
    onProgress?.(1);
    return plan.key;
  }

  const todo = missingParts(plan.parts, plan.received);
  let arrived = blob.size - todo.reduce((sum, n) => {
    const [start, end] = partBounds(n, plan.partSize, blob.size);
    return sum + (end - start);
  }, 0);
  onProgress?.(arrived / blob.size);
  for (const n of todo) {
    const [start, end] = partBounds(n, plan.partSize, blob.size);
    await sendPart(plan.id, n, blob.slice(start, end));
    arrived += end - start;
    onProgress?.(arrived / blob.size);
  }
  const { key } = await call(`${base}/${plan.id}/complete`, { method: "POST" });
  return key;
}
