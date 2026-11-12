// Pictures for the live room test: a tab shows its camera, a moving test picture, or nothing.
// The test picture is the video twin of the test sounds: one person testing alone can tell
// several kid tabs apart, and the clock and sweeping bar show at a glance that it's live.

export const PICTURE_SOURCES = [
  { id: "camera", label: "My camera", short: "Camera" },
  { id: "test", label: "Test picture", short: "Test picture" },
  { id: "off", label: "No picture", short: "Off" },
];

// The sizes Brian's picture can go out at. 720p is sharper; 540p sends about half the data to
// every kid. Each names LiveKit's preset for its top layer (h720: up to 1.7 Mbps at 30 fps; h540:
// up to 0.8 Mbps at 25 fps); both also send 180p and 360p layers for small tiles.
export const PICTURE_QUALITIES = [
  { id: "540", short: "540p", width: 960, height: 540, fps: 25, preset: "h540", topKbps: 800 },
  { id: "720", short: "720p", width: 1280, height: 720, fps: 30, preset: "h720", topKbps: 1700 },
];

const qualityOf = (id) => PICTURE_QUALITIES.find((q) => q.id === id) ?? null;

const KID_TONES = ["--rw-sea-glass", "--rw-gold", "--rw-flare", "--rw-chrome-mid"];

// The same name always gets the same colour, so a kid's tile is easy to find again.
export function toneFor(name) {
  let sum = 0;
  for (const ch of String(name)) sum += ch.codePointAt(0);
  return KID_TONES[sum % KID_TONES.length];
}

export function cameraErrorMessage(err) {
  const name = err?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "The browser wasn't allowed to use the camera.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found.";
  if (name === "NotReadableError") return "Another program is holding the camera.";
  return "The camera didn't start.";
}

// A lacquer card with the tab's name in its colour, a running clock and a bar that sweeps across
// once a second. It's redrawn on a worker's tick: a hidden tab slows the page's own timers to
// once a second, but not the messages a worker sends it.
export function testPicture({ name, tone, width = 640, height = 360 }) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  // Drawn in 640 by 360 units and scaled to the canvas, so every size shows the same card.
  g.setTransform(width / 640, 0, 0, height / 360, 0, 0);
  const css = getComputedStyle(document.documentElement);
  const read = (prop, fallback) => css.getPropertyValue(prop).trim() || fallback;
  const ground = read("--rw-ink", "#16121c");
  const text = read("--rw-cream", "#eef0ec");
  const colour = read(tone, "#ffc93c");
  const display = read("--rw-font-display", "sans-serif");
  const label = String(name).toUpperCase();
  const start = performance.now();

  function draw() {
    const t = (performance.now() - start) / 1000;
    g.fillStyle = ground;
    g.fillRect(0, 0, 640, 360);
    g.textBaseline = "middle";
    g.fillStyle = colour;
    g.font = `800 104px ${display}`;
    g.fillText(label, 40, 140, 560);
    g.fillStyle = text;
    g.font = `700 30px ${display}`;
    g.fillText(`TEST PICTURE  ·  ${t.toFixed(1)} S`, 40, 236);
    g.fillStyle = colour;
    g.fillRect((t % 1) * 700 - 80, 296, 80, 14);
  }

  draw();
  const url = URL.createObjectURL(new Blob(["setInterval(() => postMessage(0), 66);"], { type: "text/javascript" }));
  const ticker = new Worker(url);
  ticker.onmessage = draw;
  const track = canvas.captureStream(15).getVideoTracks()[0];
  return {
    track,
    stop() {
      ticker.terminate();
      URL.revokeObjectURL(url);
      track.stop();
    },
  };
}

// Puts this tab's picture into the room: the camera or the test picture, sent at a few sizes
// (simulcast) so a small tile only receives a small picture. With a quality (Brian's picture), the
// capture and the top layer are held to that size; without one, LiveKit picks from the camera.
// Returns null for "off".
export async function publishPicture(room, lk, kind, card, qualityId) {
  if (kind === "off") return null;
  const quality = qualityOf(qualityId);
  let source;
  if (kind === "camera") {
    const size = quality ?? { width: 1280, height: 720, fps: 30 };
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: size.width }, height: { ideal: size.height }, frameRate: { ideal: size.fps } },
    });
    const track = stream.getVideoTracks()[0];
    source = { track, stop: () => track.stop() };
  } else {
    source = testPicture({ ...card, ...(quality ? { width: quality.width, height: quality.height } : null) });
  }
  const options = { name: "picture", source: lk.Track.Source.Camera, simulcast: true };
  if (quality) {
    options.videoEncoding = lk.VideoPresets[quality.preset].encoding;
    options.videoSimulcastLayers = [lk.VideoPresets.h180, lk.VideoPresets.h360];
  }
  try {
    const publication = await room.localParticipant.publishTrack(source.track, options);
    return { publication, stop: source.stop, mirror: kind === "camera" };
  } catch (err) {
    source.stop();
    throw err;
  }
}

// Keeps one picture going out for a tab and swaps it cleanly. A camera that won't start falls
// back to the test picture, so the other side still sees something. `report` gets the session's
// picture fields: picture, pictureError, selfVideo (for the tab's own preview) and selfMirror.
export class PictureSender {
  constructor(report) {
    this.out = null;
    this.turn = 0;
    this.report = report;
  }

  async show(room, lk, kind, card, quality) {
    const turn = ++this.turn;
    const previous = this.out;
    this.out = null;
    this.report({ picture: kind, pictureError: "", selfVideo: null, selfMirror: false });
    await unpublishPicture(room, previous);
    let shown = kind;
    let error = "";
    let next = null;
    try {
      next = await publishPicture(room, lk, kind, card, quality);
    } catch (err) {
      error = cameraErrorMessage(err);
      shown = "off";
      if (kind === "camera") {
        next = await publishPicture(room, lk, "test", card, quality).catch(() => null);
        if (next) {
          shown = "test";
          error += " Showing the test picture instead.";
        }
      }
    }
    // A newer choice, or leaving the room, won the race: this one goes away again.
    if (turn !== this.turn) {
      await unpublishPicture(room, next);
      return;
    }
    this.out = next;
    this.report({ picture: shown, pictureError: error, selfVideo: next?.publication.track ?? null, selfMirror: Boolean(next?.mirror) });
  }

  stop() {
    this.turn++;
    this.out?.stop();
    this.out = null;
  }
}

export async function unpublishPicture(room, picture) {
  if (!picture) return;
  const track = picture.publication?.track;
  if (room && track) {
    try {
      await room.localParticipant.unpublishTrack(track, true);
    } catch {
      // already gone with the room
    }
  }
  picture.stop();
}
