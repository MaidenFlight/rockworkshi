import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_NOTES, MIDI_OFF, MidiLink, NO_DRUM, drumForNote, hitForVelocity, noteOn, sanitizeMidiPrefs } from "./midiInput.js";
import { VELOCITY } from "./midi.js";
import { LEVEL, PIECES, PIECE_IDS, layerFor, layerLevel, PIECE_BY_ID } from "./kit.js";
import { sanitizePrefs } from "./storage.js";

const db = (x) => 20 * Math.log10(x);
const near = (a, b, tolerance, message) => assert.ok(Math.abs(a - b) <= tolerance, `${message ?? ""} ${a} vs ${b}`);

test("only a note-on with some velocity is a note", () => {
  assert.deepEqual(noteOn([0x99, 38, 100]), { note: 38, velocity: 100, channel: 10 });
  assert.deepEqual(noteOn(new Uint8Array([0x90, 36, 1])), { note: 36, velocity: 1, channel: 1 });
  assert.equal(noteOn([0x99, 38, 0]), null, "a note-on at velocity 0 is a note-off");
  assert.equal(noteOn([0x89, 38, 64]), null, "note-off");
  assert.equal(noteOn([0xb9, 4, 127]), null, "the hi-hat pedal's controller");
  assert.equal(noteOn([0xa9, 49, 127]), null, "aftertouch");
  assert.equal(noteOn([0xf8]), null, "clock tick");
  assert.equal(noteOn([0xfe]), null, "active sensing");
  assert.equal(noteOn(undefined), null);
});

test("every drum's own note plays that drum, so a downloaded MIDI file plays back the same", () => {
  for (const p of PIECES) assert.equal(drumForNote(p.midi, {}), p.id, p.name);
});

test("the standard map only names drums the kit has, and covers a drum module's rims and edges", () => {
  for (const drum of Object.values(DEFAULT_NOTES)) assert.ok(PIECE_IDS.includes(drum), drum);
  const drumModule = { kick: 36, snareHead: 38, snareRim: 40, sideStick: 37, tom1: 48, tom1Rim: 50, tom2: 45, tom2Rim: 47, tom3: 43, tom3Rim: 58 };
  assert.equal(drumForNote(drumModule.snareHead), "snare");
  assert.equal(drumForNote(drumModule.snareRim), "rimshot");
  assert.equal(drumForNote(drumModule.sideStick), "sidestick");
  assert.deepEqual([drumModule.tom1, drumModule.tom1Rim].map((n) => drumForNote(n)), ["tom1", "tom1"]);
  assert.deepEqual([drumModule.tom2, drumModule.tom2Rim].map((n) => drumForNote(n)), ["tom2", "tom2"]);
  assert.deepEqual([drumModule.tom3, drumModule.tom3Rim].map((n) => drumForNote(n)), ["floorTom", "floorTom"]);
  assert.deepEqual([46, 26, 42, 22, 44].map((n) => drumForNote(n)), ["hatOpen", "hatOpen", "hatClosed", "hatClosed", "hatPedal"]);
  assert.deepEqual([49, 55, 57, 52, 51, 59, 53].map((n) => drumForNote(n)), ["crash", "crash", "crash", "crash", "ride", "ride", "rideBell"]);
});

test("a pad controller's sixteen pads from 36 up all play something", () => {
  for (let n = 36; n <= 51; n += 1) assert.ok(drumForNote(n), `note ${n}`);
});

test("a note changed by hand wins, and can be silenced; other notes play nothing", () => {
  assert.equal(drumForNote(72), null);
  assert.equal(drumForNote(72, { 72: "snare" }), "snare");
  assert.equal(drumForNote(38, { 38: "kick" }), "kick");
  assert.equal(drumForNote(38, { 38: NO_DRUM }), null);
});

test("the velocities a MIDI download writes come back as the same levels", () => {
  for (const level of [LEVEL.ghost, LEVEL.normal, LEVEL.accent]) assert.equal(hitForVelocity("snare", VELOCITY[level]).level, level);
});

test("a normal hit at 92 is untouched", () => {
  for (const id of PIECE_IDS) assert.deepEqual(hitForVelocity(id, 92), { level: LEVEL.normal, gain: 1 }, id);
});

// What is actually heard: the recording's own level times the gain on top.
const heard = (id, velocity) => {
  const { level, gain } = hitForVelocity(id, velocity);
  return layerLevel(PIECE_BY_ID[id], level) * gain;
};

test("harder is always louder, for every drum, with no step where the recording changes", () => {
  for (const id of PIECE_IDS) {
    for (let v = 2; v <= 127; v += 1) assert.ok(heard(id, v) > heard(id, v - 1), `${id} at ${v}`);
  }
  // The kick's soft recordings are much louder than the snare's; it follows the same line.
  near(db(heard("kick", 46)), db(heard("snare", 46)), 0.01);
  near(db(heard("kick", 46)), -12, 0.1);
  near(db(heard("snare", 127)), 5.6, 0.1);
});

test("a layer's real level is what the volume corrects for", () => {
  const snare = PIECE_BY_ID.snare;
  near(db(layerLevel(snare, LEVEL.ghost)), -12, 0.01);
  near(db(layerLevel(snare, LEVEL.accent)), 2.8, 0.01);
  assert.equal(layerLevel(snare, LEVEL.normal), 1);
  // No soft or hard recording of its own: the voice turns the main one up or down by layerFor's gain.
  const side = PIECE_BY_ID.sidestick;
  assert.equal(layerLevel(side, LEVEL.ghost), layerFor(side, LEVEL.ghost).gain);
  assert.equal(layerLevel(side, LEVEL.accent), layerFor(side, LEVEL.accent).gain);
});

test("every soft or hard recording has its measured level", () => {
  for (const p of PIECES) {
    for (const name of ["ghost", "accent"]) {
      if (p.files[name]) assert.equal(typeof p.layerDb?.[name], "number", `${p.id} ${name}`);
    }
  }
});

test("saved MIDI settings are cleaned on the way in", () => {
  assert.deepEqual(sanitizeMidiPrefs(undefined), { on: false, notes: {} });
  assert.deepEqual(sanitizeMidiPrefs("nonsense"), { on: false, notes: {} });
  assert.deepEqual(
    sanitizeMidiPrefs({ on: true, notes: { 72: "snare", 38: "kick", 200: "snare", abc: "snare", 60: "cowbell", 61: NO_DRUM, 36: "kick" } }),
    { on: true, notes: { 72: "snare", 38: "kick" } },
    "bad notes and drums are dropped; a change that matches the standard note, or silences a note that plays nothing, isn't kept",
  );
  assert.deepEqual(sanitizeMidiPrefs({ notes: { 38: NO_DRUM } }).notes, { 38: NO_DRUM }, "silencing a note that does play something is kept");
  assert.deepEqual(sanitizePrefs({}).midi, { on: false, notes: {} }, "prefs saved before MIDI existed still load");
});

// ---- the connection, against a stand-in for the browser ----

function fakePort(id, name, state = "connected") {
  return {
    id,
    name,
    manufacturer: "",
    state,
    closed: 0,
    onmidimessage: null,
    close() {
      this.closed += 1;
      return Promise.resolve(this);
    },
    send(bytes) {
      this.onmidimessage?.({ data: new Uint8Array(bytes) });
    },
  };
}

function fakeNavigator({ ports = [], permission = "granted", reject = null } = {}) {
  const inputs = new Map(ports.map((p) => [p.id, p]));
  const access = {
    inputs,
    onstatechange: null,
    plug(port) {
      inputs.set(port.id, port);
      this.onstatechange?.({ port });
    },
    unplug(port) {
      port.state = "disconnected";
      this.onstatechange?.({ port });
    },
  };
  const nav = {
    access,
    requests: [],
    queries: [],
    requestMIDIAccess(options) {
      nav.requests.push(options);
      return reject ? Promise.reject(Object.assign(new Error("no"), { name: reject })) : Promise.resolve(access);
    },
    permissions: {
      query(descriptor) {
        nav.queries.push(descriptor);
        return Promise.resolve({ state: permission });
      },
    },
  };
  return nav;
}

test("a browser without MIDI says so and never tries", async () => {
  const link = new MidiLink({});
  assert.equal(link.getState().status, "unsupported");
  assert.equal(await link.connect(), false);
  assert.equal(await link.resume(), false);
  link.disconnect();
  assert.equal(link.getState().status, "unsupported");
  assert.equal(new MidiLink(null).getState().status, "unsupported");
});

test("connecting asks without sysex, lists the devices and passes on the notes", async () => {
  const pad = fakePort("a", "  MPD218 ");
  const kit = fakePort("b", "", "connected");
  kit.manufacturer = "Roland";
  const nav = fakeNavigator({ ports: [pad, kit] });
  const link = new MidiLink(nav);
  const seen = [];
  link.setNoteHandler((n) => seen.push(n));
  const states = [];
  link.subscribe(() => states.push(link.getState().status));

  assert.equal(link.getState(), MIDI_OFF);
  assert.equal(await link.connect(), true);
  assert.deepEqual(nav.requests, [{ sysex: false }]);
  assert.equal(states[0], "asking");
  assert.deepEqual(link.getState(), { status: "on", devices: [{ id: "a", name: "MPD218" }, { id: "b", name: "Roland" }] });

  pad.send([0x90, 38, 90]);
  kit.send([0x99, 36, 120]);
  kit.send([0xf8]);
  kit.send([0x99, 36, 0]);
  pad.send([0x90, 72, 50]);
  assert.deepEqual(seen, [
    { note: 38, velocity: 90, channel: 1, drum: "snare" },
    { note: 36, velocity: 120, channel: 10, drum: "kick" },
    { note: 72, velocity: 50, channel: 1, drum: null },
  ]);
  assert.deepEqual(link.getLastNote(), { note: 72, velocity: 50, channel: 1, drum: null });

  link.setNotes({ 72: "crash" });
  pad.send([0x90, 72, 50]);
  assert.equal(seen.at(-1).drum, "crash");
});

test("a second press while connected or while the prompt is up doesn't ask again", async () => {
  const nav = fakeNavigator();
  const link = new MidiLink(nav);
  const first = link.connect();
  assert.equal(await link.connect(), false, "the prompt is already up");
  await first;
  assert.equal(await link.connect(), true);
  assert.equal(nav.requests.length, 1);
});

test("a refusal and a failure are told apart, and pressing Connect again tries again", async () => {
  for (const [name, status] of [["NotAllowedError", "blocked"], ["SecurityError", "blocked"], ["AbortError", "failed"]]) {
    const nav = fakeNavigator({ reject: name });
    const link = new MidiLink(nav);
    assert.equal(await link.connect(), false);
    assert.equal(link.getState().status, status, name);
    await link.connect();
    assert.equal(nav.requests.length, 2);
  }
});

test("devices plugged in and pulled out while connected come and go, and one plugged back works", async () => {
  const pad = fakePort("a", "Pads");
  const nav = fakeNavigator({ ports: [pad] });
  const link = new MidiLink(nav);
  const seen = [];
  link.setNoteHandler((n) => seen.push(n.note));
  await link.connect();

  const kit = fakePort("b", "Kit");
  nav.access.plug(kit);
  assert.deepEqual(link.getState().devices.map((d) => d.name), ["Pads", "Kit"]);
  kit.send([0x99, 38, 90]);
  assert.deepEqual(seen, [38]);

  nav.access.unplug(kit);
  assert.deepEqual(link.getState().devices.map((d) => d.name), ["Pads"]);
  assert.equal(kit.onmidimessage, null);

  kit.state = "connected";
  nav.access.onstatechange({ port: kit });
  assert.deepEqual(link.getState().devices.map((d) => d.name), ["Pads", "Kit"]);
  kit.send([0x99, 36, 90]);
  assert.deepEqual(seen, [38, 36]);
});

test("a state change that changes nothing doesn't redraw", async () => {
  const pad = fakePort("a", "Pads");
  const nav = fakeNavigator({ ports: [pad] });
  const link = new MidiLink(nav);
  await link.connect();
  let redraws = 0;
  link.subscribe(() => (redraws += 1));
  nav.access.onstatechange({ port: pad });
  assert.equal(redraws, 0);
});

test("disconnecting gives every device back, stops the notes and forgets the last one", async () => {
  const pad = fakePort("a", "Pads");
  const nav = fakeNavigator({ ports: [pad] });
  const link = new MidiLink(nav);
  const seen = [];
  link.setNoteHandler((n) => seen.push(n.note));
  await link.connect();
  const handler = pad.onmidimessage;
  pad.send([0x90, 38, 90]);

  link.disconnect();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(link.getState(), MIDI_OFF);
  assert.equal(pad.onmidimessage, null);
  assert.equal(pad.closed, 1);
  assert.equal(link.getLastNote(), null);
  assert.equal(nav.access.onstatechange, null);
  assert.ok(handler);
  assert.deepEqual(seen, [38]);

  assert.equal(await link.connect(), true, "and can connect again");
  pad.send([0x90, 36, 90]);
  assert.deepEqual(seen, [38, 36]);
});

test("a return visit reconnects only if the browser already allows it, and never prompts", async () => {
  const allowed = fakeNavigator({ ports: [fakePort("a", "Pads")], permission: "granted" });
  const link = new MidiLink(allowed);
  assert.equal(await link.resume(), true);
  assert.deepEqual(allowed.queries, [{ name: "midi", sysex: false }]);
  assert.equal(link.getState().status, "on");

  for (const permission of ["prompt", "denied"]) {
    const nav = fakeNavigator({ permission });
    const other = new MidiLink(nav);
    assert.equal(await other.resume(), false, permission);
    assert.equal(nav.requests.length, 0, `${permission}: no prompt`);
    assert.equal(other.getState(), MIDI_OFF);
  }

  const noQuery = fakeNavigator();
  noQuery.permissions.query = () => Promise.reject(new TypeError("unknown permission"));
  const other = new MidiLink(noQuery);
  assert.equal(await other.resume(), false, "a browser that can't say gets the button");
  assert.equal(noQuery.requests.length, 0);
});

test("leaving while a connection is on its way cancels it", async () => {
  const pad = fakePort("a", "Pads");
  const nav = fakeNavigator({ ports: [pad] });
  const link = new MidiLink(nav);
  const connecting = link.connect();
  link.disconnect();
  assert.equal(await connecting, false);
  assert.equal(link.getState(), MIDI_OFF);
  assert.equal(pad.onmidimessage, null);

  const resuming = link.resume();
  link.disconnect();
  assert.equal(await resuming, false);
  assert.equal(nav.requests.length, 1, "the cancelled resume asked for nothing");
});
