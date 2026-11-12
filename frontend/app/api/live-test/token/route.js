import { AccessToken } from "livekit-server-sdk";
import { HOST_IDENTITY, KID_SOUNDS, LIVE_TEST_ROOM } from "@/lib/live/protocol";

// Room passes for the live room test (/live-test). A pass is a signed token that lets one browser
// tab into the test room on the LiveKit server, as Brian's mixer or as a kid.
//
// On a developer's computer it needs no set-up: with no LIVEKIT_* variables it uses the key that a
// LiveKit server started with --dev accepts. Anywhere else it stays switched off unless
// LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVE_TEST_PASSCODE are all set, so a
// deploy never opens a room nobody configured.

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function settings() {
  const local = process.env.NODE_ENV !== "production";
  const url = process.env.LIVEKIT_URL || (local ? "ws://localhost:7880" : "");
  const apiKey = process.env.LIVEKIT_API_KEY || (local ? "devkey" : "");
  const apiSecret = process.env.LIVEKIT_API_SECRET || (local ? "secret" : "");
  const passcode = process.env.LIVE_TEST_PASSCODE || "";
  return { url, apiKey, apiSecret, passcode, enabled: Boolean(url && apiKey && apiSecret && (local || passcode)) };
}

// Tells the page whether the test is on here and whether it should ask for the passcode.
export async function GET() {
  const { enabled, passcode } = settings();
  return Response.json({ enabled, needsPasscode: enabled && Boolean(passcode) }, { headers: NO_STORE });
}

export async function POST(request) {
  const { url, apiKey, apiSecret, passcode, enabled } = settings();
  if (!enabled) {
    return Response.json({ error: "The live room test is switched off here." }, { status: 404, headers: NO_STORE });
  }
  const body = await request.json().catch(() => ({}));
  if (passcode && body?.passcode !== passcode) {
    return Response.json({ error: "That passcode isn't right." }, { status: 403, headers: NO_STORE });
  }

  const role = body?.role === "host" ? "host" : "kid";
  const sound = KID_SOUNDS.some((s) => s.id === body?.sound) ? body.sound : "mic";
  const typed = String(body?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 32);
  const name = typed || (role === "host" ? "Brian" : "Kid");
  const identity = role === "host" ? HOST_IDENTITY : `kid-${crypto.randomUUID().slice(0, 8)}`;

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: "6h",
    attributes: role === "host" ? { role } : { role, sound },
  });
  token.addGrant({
    room: LIVE_TEST_ROOM,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    // Only the mixer changes its own attributes: that is how it tells the room who is on stage.
    canUpdateOwnMetadata: role === "host",
  });

  return Response.json({ url, token: await token.toJwt(), identity, name, role }, { headers: NO_STORE });
}
