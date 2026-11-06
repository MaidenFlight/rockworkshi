// Mix presets belong to one person and one song. A student's only cover their own part and the
// backing band (lib/instrumentAccess.js); staff keep every stem. Runs against the dev database in
// .env with throwaway @example.test accounts.
require("dotenv").config({ quiet: true });

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { signMobileToken } = require("../src/lib/mobileToken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

const RUN = `mix-test-${Date.now()}`;
let server;
let base;
let song;
const users = {};
const tokens = {};

async function call(who, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const settings = {
  mode: "minus",
  focus: "Guitar",
  master: 90,
  take: 75,
  takeMuted: false,
  stems: {
    Vocals: { volume: 60, muted: false, soloed: false },
    Drums: { volume: 100, muted: false, soloed: true },
    Bass: { volume: 100, muted: false, soloed: true },
    Cowbell: { volume: 100, muted: false, soloed: false },
    Guitar: { volume: 80, muted: true, soloed: false },
    Backing: { volume: 65, muted: false, soloed: true },
  },
  effects: { bypass: false, low: 1, mid: 2, high: -1, drive: 35, reverb: 10, size: "small", output: -2 },
};

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;
  for (const name of ["a", "b", "unpaid", "teacher", "nobody"]) {
    users[name] = await prisma.user.create({
      data: {
        email: `${RUN}-${name}@example.test`,
        passwordHash: "!no-login",
        instrument: name === "nobody" ? null : "Guitar",
        ...(name === "teacher" ? { role: "teacher" } : {}),
        ...(name === "unpaid" ? {} : { paidAt: new Date() }),
      },
    });
    tokens[name] = signMobileToken(users[name], "10m");
  }
  song = await prisma.song.create({ data: { title: `${RUN} song` } });
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  if (song) await prisma.song.delete({ where: { id: song.id } });
  await prisma.$disconnect();
  server.close();
});

test("presets are saved per student and song, and cleaned on the way in", async () => {
  const path = `/songs/${song.id}/mix-presets`;
  assert.equal((await call(null, "GET", path)).status, 401);
  assert.equal((await call("unpaid", "GET", path)).status, 402);

  const saved = await call("a", "PUT", path, { name: "  Drums & bass ", settings });
  assert.equal(saved.status, 201);
  assert.equal(saved.data.preset.name, "Drums & bass");
  const kept = saved.data.preset.settings;
  assert.deepEqual(Object.keys(kept.stems).sort(), ["Backing", "Guitar"], "only their own part and the backing band");
  assert.deepEqual(kept.stems.Guitar, { volume: 80, muted: false, soloed: false }, "no mute or solo: the play modes do that");
  assert.deepEqual(kept.stems.Backing, { volume: 65, muted: false, soloed: false });
  assert.equal(kept.focus, "Guitar");
  assert.equal(kept.instrument, "Guitar", "stamped with the instrument it was made for");
  assert.equal(kept.effects.size, "small");

  // Same name replaces rather than duplicates.
  const replaced = await call("a", "PUT", path, { name: "Drums & bass", settings: { ...settings, master: 50 } });
  assert.equal(replaced.status, 200);
  const mine = await call("a", "GET", path);
  assert.equal(mine.data.presets.length, 1);
  assert.equal(mine.data.presets[0].settings.master, 50);

  // Another student sees none of it and can't delete it.
  assert.equal((await call("b", "GET", path)).data.presets.length, 0);
  assert.equal((await call("b", "DELETE", `${path}/${mine.data.presets[0].id}`)).status, 404);
  assert.equal((await call("a", "DELETE", `${path}/${mine.data.presets[0].id}`)).status, 204);
});

test("staff presets keep every stem, whatever their own instrument", async () => {
  const path = `/songs/${song.id}/mix-presets`;
  const saved = await call("teacher", "PUT", path, { name: "Whole band", settings });
  assert.equal(saved.status, 201);
  assert.deepEqual(Object.keys(saved.data.preset.settings.stems).sort(), ["Bass", "Drums", "Guitar", "Vocals"], "unknown parts dropped");
  assert.equal(saved.data.preset.settings.stems.Drums.soloed, true);
  assert.equal((await call("teacher", "GET", path)).data.presets.length, 1);
});

test("bad preset input is refused", async () => {
  const path = `/songs/${song.id}/mix-presets`;
  assert.equal((await call("a", "PUT", path, { name: "", settings })).status, 400);
  assert.equal((await call("a", "PUT", path, { name: "x".repeat(41), settings })).status, 400);
  assert.equal(
    (await call("a", "PUT", path, { name: "Loud", settings: { ...settings, master: 150 } })).status,
    400,
    "volume over 100%"
  );
  assert.equal(
    (await call("a", "PUT", path, { name: "Loud", settings: { ...settings, effects: { ...settings.effects, drive: 400 } } }))
      .status,
    400
  );
  assert.equal((await call("a", "PUT", "/songs/not-a-song/mix-presets", { name: "x", settings })).status, 404);
  assert.equal((await call("nobody", "PUT", path, { name: "x", settings })).status, 400, "no instrument, nothing to mix");
});

test("a student keeps at most 20 presets per song", async () => {
  const path = `/songs/${song.id}/mix-presets`;
  for (let i = 0; i < 20; i++) {
    assert.equal((await call("b", "PUT", path, { name: `Mix ${i}`, settings })).status, 201);
  }
  assert.equal((await call("b", "PUT", path, { name: "One more", settings })).status, 409);
  assert.equal((await call("b", "PUT", path, { name: "Mix 3", settings })).status, 200, "replacing still works");
});
