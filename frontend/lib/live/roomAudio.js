// Pieces both ends of the live room test share: asking for a room pass, the microphone settings
// for singing, and playing a remote track through our own audio graph.

// Singing needs the browser's speech clean-up off: echo cancelling, noise suppression and
// automatic gain all treat a held note as something to remove. That is also why everyone needs
// headphones: with echo cancelling off, sound from a speaker goes straight back into the mic.
export const SINGING_MIC = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
};

export async function fetchRoomPass({ role, name, sound, passcode }) {
  const res = await fetch("/api/live-test/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, name, sound, passcode }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Couldn't get a room pass (error ${res.status}).`);
  return data;
}

// Plays a remote track through our own AudioContext, where a gain can open and close it smoothly
// and a meter can read it. Chrome only feeds a remote WebRTC track into Web Audio while a media
// element is also playing it, so a muted <audio> element holds it open.
export function tapRemoteTrack(ctx, mediaStreamTrack) {
  const stream = new MediaStream([mediaStreamTrack]);
  const holder = new Audio();
  holder.muted = true;
  holder.srcObject = stream;
  holder.play().catch(() => {});
  const source = ctx.createMediaStreamSource(stream);
  return {
    source,
    stop() {
      try {
        source.disconnect();
      } catch {
        // already disconnected
      }
      holder.pause();
      holder.srcObject = null;
    },
  };
}

// Moves a gain to a new value over a few milliseconds, so switching doesn't click.
export function glide(param, value, ctx) {
  param.setTargetAtTime(value, ctx.currentTime, 0.006);
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function micErrorMessage(err) {
  const name = err?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "The browser wasn't allowed to use the microphone.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone was found.";
  if (name === "NotReadableError") return "Another program is holding the microphone.";
  return "The microphone didn't start.";
}

// What to say when joining fails. Locally, the likely cause is that the room server isn't running.
export function joinErrorMessage(err) {
  const text = String(err?.message ?? err ?? "");
  if (/signal connection|websocket|failed to fetch|networkerror|could not connect/i.test(text)) {
    return "Couldn't reach the room server. Is LiveKit running?";
  }
  if (/pc connection|peer ?connection|\bice\b/i.test(text)) {
    return "The room answered, but the sound link couldn't connect. Try again; if it keeps happening, restart the room server.";
  }
  return text || "Something went wrong joining the room.";
}
