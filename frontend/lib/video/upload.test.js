import { test } from "node:test";
import assert from "node:assert/strict";
import { missingParts, partBounds, uploadVideo } from "./upload.js";

const SIZE = 25;
const PART = 10;
const video = () => new Blob([new Uint8Array(SIZE)], { type: "video/mp4;codecs=avc1" });
const noWait = async () => {};

// A stand-in for the API, recording what's asked of it. fail(n, attempt) says whether a piece fails.
function server({ received = [], complete = false, gone = false, fail = () => false } = {}) {
  const log = { parts: [], started: 0, completed: 0, attempts: {} };
  const have = new Set(received);
  const reply = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status });
  const fetchFn = async (url, options = {}) => {
    const path = new URL(url).pathname.replace(/^\/assignments\/task\/video-uploads/, "");
    if (options.method === "POST" && path === "") {
      log.started++;
      log.start = JSON.parse(options.body);
      return reply(201, { id: "new", parts: 3, partSize: PART });
    }
    if (!options.method) {
      if (gone) return reply(404, { error: "Not found." });
      return reply(200, complete ? { complete: true, key: "the-key", parts: 3, partSize: PART, received: [] } : { complete: false, parts: 3, partSize: PART, received: [...have] });
    }
    const part = /\/parts\/(\d+)$/.exec(path);
    if (part) {
      const n = Number(part[1]);
      log.attempts[n] = (log.attempts[n] ?? 0) + 1;
      const trouble = fail(n, log.attempts[n]);
      if (trouble === "network") throw new TypeError("Failed to fetch");
      if (trouble) return reply(trouble);
      log.parts.push([n, options.body.size]);
      have.add(n);
      return reply(204);
    }
    if (path.endsWith("/complete")) {
      log.completed++;
      return reply(200, { key: "the-key" });
    }
    throw new Error(`Unexpected ${options.method} ${path}`);
  };
  return { log, fetchFn };
}

test("which pieces are left, and where each sits", () => {
  assert.deepEqual(missingParts(4, [1, 3]), [2, 4]);
  assert.deepEqual(missingParts(2, []), [1, 2]);
  assert.deepEqual(partBounds(1, 10, 25), [0, 10]);
  assert.deepEqual(partBounds(3, 10, 25), [20, 25], "the last piece is only what's left");
});

test("a video goes up piece by piece", async () => {
  const { log, fetchFn } = server();
  const progress = [];
  let started = null;
  const key = await uploadVideo("task", video(), { fetchFn, wait: noWait, duration: 60, onStarted: (id) => (started = id), onProgress: (p) => progress.push(p) });
  assert.equal(key, "the-key");
  assert.equal(started, "new");
  assert.deepEqual(log.start, { size: SIZE, type: "video/mp4;codecs=avc1", duration: 60 });
  assert.deepEqual(log.parts, [[1, 10], [2, 10], [3, 5]]);
  assert.deepEqual(progress, [0, 0.4, 0.8, 1]);
  assert.equal(log.completed, 1);
});

test("a piece that fails is tried again", async () => {
  const { log, fetchFn } = server({ fail: (n, attempt) => (n === 2 && attempt < 3 ? 500 : false) });
  assert.equal(await uploadVideo("task", video(), { fetchFn, wait: noWait }), "the-key");
  assert.equal(log.attempts[2], 3);
  assert.deepEqual(log.parts.map(([n]) => n), [1, 2, 3]);
});

test("when a piece won't go, it stops and says the video is safe", async () => {
  const { log, fetchFn } = server({ fail: (n) => (n === 2 ? "network" : false) });
  await assert.rejects(uploadVideo("task", video(), { fetchFn, wait: noWait }), /Your video is still here/);
  assert.equal(log.attempts[2], 3, "after the retries");
  assert.equal(log.attempts[3], undefined, "nothing after it");
  assert.equal(log.completed, 0, "and it isn't finished");
});

test("resuming sends only what hasn't arrived", async () => {
  const { log, fetchFn } = server({ received: [1, 3] });
  const progress = [];
  assert.equal(await uploadVideo("task", video(), { fetchFn, wait: noWait, uploadId: "earlier", onProgress: (p) => progress.push(p) }), "the-key");
  assert.equal(log.started, 0, "no new upload");
  assert.deepEqual(log.parts, [[2, 10]]);
  assert.deepEqual(progress, [0.6, 1]);
});

test("an upload that had already finished just hands back its file", async () => {
  const { log, fetchFn } = server({ complete: true });
  assert.equal(await uploadVideo("task", video(), { fetchFn, wait: noWait, uploadId: "earlier" }), "the-key");
  assert.equal(log.parts.length, 0);
  assert.equal(log.completed, 0);
});

test("an upload the server no longer has starts again", async () => {
  const { log, fetchFn } = server({ gone: true });
  let started = null;
  assert.equal(await uploadVideo("task", video(), { fetchFn, wait: noWait, uploadId: "old", onStarted: (id) => (started = id) }), "the-key");
  assert.equal(log.started, 1);
  assert.equal(started, "new");
  assert.equal(log.parts.length, 3);
});

test("a refusal is passed on, not retried", async () => {
  const { log, fetchFn } = server({ fail: (n) => (n === 1 ? 400 : false) });
  await assert.rejects(uploadVideo("task", video(), { fetchFn, wait: noWait }));
  assert.equal(log.attempts[1], 1);
});
