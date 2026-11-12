import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

// Songs Brian can play into the live room test (/live-test), on a developer's computer only.
//
// GET                 the list: every audio file in LIVE_TEST_SONGS_DIR, named by its file name.
// GET ?play=<name>    that file, with byte ranges so the player can seek.
//
// Song recordings never go in git (see .gitignore), so this reads a local folder that is set in
// .env.local. It is switched off on the live site, where a real version would play songs from the
// school's library instead.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPES = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
};

function songsDir() {
  if (process.env.NODE_ENV === "production") return "";
  return process.env.LIVE_TEST_SONGS_DIR || "";
}

async function listSongs(dir) {
  const names = await fs.readdir(dir).catch(() => []);
  return names
    .filter((name) => TYPES[path.extname(name).toLowerCase()])
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ id: name, title: path.basename(name, path.extname(name)) }));
}

// "bytes=start-end", "bytes=start-" or "bytes=-suffix". Null when it can't be served.
function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start;
  let end;
  if (m[1] === "") {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start <= end && start < size ? { start, end } : null;
}

export async function GET(request) {
  const dir = songsDir();
  const headers = { "Cache-Control": "no-store" };
  if (!dir) return Response.json({ songs: [], note: "No songs are set up for the test here." }, { headers });

  const songs = await listSongs(dir);
  const wanted = new URL(request.url).searchParams.get("play");
  if (wanted === null) return Response.json({ songs }, { headers });

  // Only a name from the list is served, so nothing outside the folder can be reached.
  const song = songs.find((s) => s.id === wanted);
  if (!song) return new Response("Not found", { status: 404, headers });
  const file = path.join(dir, song.id);
  const { size } = await fs.stat(file);
  const type = TYPES[path.extname(file).toLowerCase()];

  const rangeHeader = request.headers.get("range");
  const range = rangeHeader ? parseRange(rangeHeader, size) : { start: 0, end: size - 1 };
  if (!range) {
    return new Response("Range not satisfiable", { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  }
  const body = Readable.toWeb(createReadStream(file, { start: range.start, end: range.end }));
  return new Response(body, {
    status: rangeHeader ? 206 : 200,
    headers: {
      ...headers,
      "Content-Type": type,
      "Content-Length": String(range.end - range.start + 1),
      "Accept-Ranges": "bytes",
      ...(rangeHeader ? { "Content-Range": `bytes ${range.start}-${range.end}/${size}` } : {}),
    },
  });
}
