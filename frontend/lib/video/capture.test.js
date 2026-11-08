import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraConstraints, cameraProblem, micConstraints, pickVideoFormat } from "./capture.js";

test("MP4 is chosen where the browser can record it", () => {
  assert.equal(pickVideoFormat(() => true), "video/mp4;codecs=avc1,mp4a.40.2");
  assert.equal(pickVideoFormat((t) => t === "video/mp4"), "video/mp4", "Safari's plain MP4");
});

test("WebM is the fallback", () => {
  assert.equal(pickVideoFormat((t) => t.startsWith("video/webm")), "video/webm;codecs=vp9,opus");
  assert.equal(pickVideoFormat((t) => t === "video/webm;codecs=vp8,opus"), "video/webm;codecs=vp8,opus");
});

test("a browser that can't record any says so", () => {
  assert.equal(pickVideoFormat(() => false), null);
});

test("the microphone isn't processed like a phone call", () => {
  const audio = micConstraints(null);
  assert.deepEqual([audio.echoCancellation, audio.noiseSuppression, audio.autoGainControl], [false, false, false]);
  assert.equal(audio.deviceId, undefined);
  assert.deepEqual(micConstraints("usb-mic").deviceId, { ideal: "usb-mic" }, "a chosen mic that's gone falls back to another");
  assert.deepEqual(cameraConstraints("usb-mic").audio.deviceId, { ideal: "usb-mic" });
  assert.equal(cameraConstraints(null).video.height.ideal, 720);
});

test("camera trouble is put in words", () => {
  assert.match(cameraProblem({ name: "NotAllowedError" }), /blocked/);
  assert.match(cameraProblem({ name: "NotFoundError" }), /No camera/);
  assert.match(cameraProblem({ name: "NotReadableError" }), /being used/);
  assert.match(cameraProblem(new Error("odd")), /wouldn't open/);
});
