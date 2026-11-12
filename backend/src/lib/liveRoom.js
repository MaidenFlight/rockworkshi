// The video room behind a meeting, on LiveKit. In development it uses the LiveKit server's dev mode
// (ws://localhost:7880, key "devkey", secret "secret"). In production it needs LIVEKIT_URL,
// LIVEKIT_API_KEY and LIVEKIT_API_SECRET; until they're set, meetings can be scheduled and started
// but nobody can get into the room, and the site says video isn't set up yet.
const { AccessToken, RoomServiceClient } = require("livekit-server-sdk");

// Same as the frontend's lib/live/protocol.js: the mixer is always "host", which is how the kids'
// pages know whose sound and picture to take and who may hear them.
const HOST_IDENTITY = "host";

function liveConfig() {
  const { LIVEKIT_URL: url, LIVEKIT_API_KEY: key, LIVEKIT_API_SECRET: secret } = process.env;
  if (url && key && secret) return { url, key, secret };
  if (process.env.NODE_ENV !== "production") return { url: "ws://localhost:7880", key: "devkey", secret: "secret" };
  return null;
}

const roomName = (meeting) => `meeting-${meeting.id}`;

// A pass into the meeting's room. The host may set its own attributes (that's how the mixer tells
// the kids' pages who is on stage); students may not. Students arrive with their microphone as
// their sound.
async function roomPass(meeting, user, { host }) {
  const config = liveConfig();
  if (!config) return null;
  const identity = host ? HOST_IDENTITY : `kid-${user.id}`;
  const name = (user.name || (host ? "Host" : "Student")).slice(0, 40);
  const token = new AccessToken(config.key, config.secret, {
    identity,
    name,
    ttl: "4h",
    attributes: host ? { role: "host" } : { role: "kid", sound: "mic" },
  });
  token.addGrant({
    roomJoin: true,
    room: roomName(meeting),
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: Boolean(host),
  });
  return { url: config.url, token: await token.toJwt(), name, identity, room: roomName(meeting) };
}

// Ending a meeting closes its room, which sends everyone in it out.
async function closeRoom(meeting) {
  const config = liveConfig();
  if (!config) return;
  const http = config.url.replace(/^ws/, "http");
  try {
    await new RoomServiceClient(http, config.key, config.secret).deleteRoom(roomName(meeting));
  } catch (err) {
    // No room (nobody ever joined) is fine; anything else only logs, the meeting is ended either way.
    if (!/not.?found|404/i.test(String(err?.message))) console.error("Could not close the meeting room:", err.message);
  }
}

module.exports = { HOST_IDENTITY, liveConfig, roomPass, closeRoom };
