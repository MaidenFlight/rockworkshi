// The live room test (/live-test): the names Brian's mixer, the kids' pages and the room-pass
// route all agree on. Plain constants and helpers, safe on the server and in the browser.

export const LIVE_TEST_ROOM = "rockworks-live-test";

// There is one mixer. A second tab that joins as Brian takes over and the first one leaves.
export const HOST_IDENTITY = "host";

// Brian's mixer publishes what it is doing as its own participant attributes, and the kids'
// pages read them. Each value is a kid's identity, or "" for nobody.
export const ATTR_LISTENING = "listening"; // the kid Brian has picked to hear
export const ATTR_STAGE = "stage"; // the kid everyone hears
export const ATTR_WITH_MUSIC = "withMusic"; // the kid who sends their voice mixed with what they hear
export const ATTR_MEASURING = "measuring"; // the kid whose round trip the mixer is timing
export const ATTR_GALLERY = "gallery"; // "on" while Brian lets kids see each other; unset means off

// Data messages between the mixer and one kid travel under this topic.
export const DATA_TOPIC = "live-test";
export const MSG_MEASURE_READY = "measure-ready";

// The delay test's beep. Well above the test sounds and the click, so nothing else sets it off.
export const PING_HZ = 2600;

// What a kid's page can send. The microphone is the real thing; the others are made in the
// browser so one person can tell several kid tabs apart by ear.
export const KID_SOUNDS = [
  { id: "mic", label: "My microphone", short: "Microphone" },
  { id: "melody", label: "Test sound: melody", short: "Melody" },
  { id: "hum", label: "Test sound: low hum", short: "Low hum" },
  { id: "drums", label: "Test sound: drum beat", short: "Drum beat" },
];

export function soundName(id) {
  return KID_SOUNDS.find((s) => s.id === id)?.short ?? "";
}

export function encodeMessage(message) {
  return new TextEncoder().encode(JSON.stringify(message));
}

export function decodeMessage(payload) {
  try {
    return JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return null;
  }
}
