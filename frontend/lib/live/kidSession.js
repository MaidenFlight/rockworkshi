import { analyser as makeAnalyser } from "@/lib/audio/meters";
import {
  ATTR_GALLERY,
  ATTR_LISTENING,
  ATTR_MEASURING,
  ATTR_STAGE,
  ATTR_WITH_MUSIC,
  DATA_TOPIC,
  HOST_IDENTITY,
  MSG_MEASURE_READY,
  encodeMessage,
} from "./protocol";
import { SINGING_MIC, fetchRoomPass, glide, joinErrorMessage, micErrorMessage, tapRemoteTrack } from "./roomAudio";
import { renderTestSound } from "./testSounds";
import { PictureSender, toneFor } from "./video";

const ONLY_BRIAN = [{ participantIdentity: HOST_IDENTITY, allowAll: true }];

// A kid's side of the live room test.
//
// The kid sends their sound (the mic, or a test sound when one person is testing alone), plus
// Brian's sound mixed back in when the mixer asks for it ("with the music", and the delay test),
// and a picture (the camera, a test picture, or none). They see and hear Brian and whoever Brian
// puts on stage, and see the other kids like a video call, but never hear them.
//
// The room server enforces who receives what, not just this page: Brian may take all of this
// kid's tracks, the other kids only the picture (and only while Brian lets kids see each other),
// so another kid's page couldn't listen in even if it tried. On stage, the kid allows everyone.
export class KidSession {
  constructor() {
    this.listeners = new Set();
    this.state = {
      status: "idle", // idle | connecting | connected | ended | error
      error: "",
      name: "",
      sound: "melody",
      micError: "",
      hostHere: false,
      hostName: "Brian",
      heardByBrian: false,
      onStage: false,
      measuring: false,
      sendingBack: false,
      stageName: "",
      hearing: [],
      speakerOn: true,
      picture: "test", // camera | test | off
      pictureError: "",
      selfVideo: null, // this kid's own picture, for the preview
      selfMirror: false,
      brianVideo: null,
      stageVideo: null,
      galleryOn: false, // whether Brian lets kids see each other
      gallery: [], // { identity, name, video } for the other kids
    };
    this.pictures = new PictureSender((patch) => this.set(patch));
    this.permissionKey = "";
    this.videos = new Map(); // identity -> picture this kid is receiving
    this.taps = new Map(); // identity -> tap, for every sound this kid is receiving
    this.wanted = new Map(); // track sid -> whether this page asked to receive it
    this.room = null;
    this.ctx = null;
    this.myId = "";
    this.ended = false;
  }

  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.state;

  set(patch) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  getSendMeter() {
    return this.sendMeter ?? null;
  }

  // Call this from the click that joins: browsers only let a page start sound inside a click.
  // getPass: where the room pass comes from (a real meeting asks the site); the test room by default.
  async join({ name, sound, passcode, picture = "test", getPass = null }) {
    if (this.state.status !== "idle") return;
    this.set({ status: "connecting", error: "", sound, picture });
    try {
      this.ctx = new AudioContext({ latencyHint: "interactive" });
      const resumed = this.ctx.resume();
      this.lk = await import("livekit-client");
      await resumed;
      this.buildGraph();
      await this.setSound(sound);
      const pass = getPass ? await getPass() : await fetchRoomPass({ role: "kid", name, sound, passcode });
      const { Room, Track, AudioPresets } = this.lk;
      // adaptiveStream sends each video at the size it's shown and pauses video nobody can see.
      const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });
      this.room = room;
      this.wire(room);
      await room.connect(pass.url, pass.token, { autoSubscribe: false });
      this.myId = room.localParticipant.identity;
      // Set before the track goes out, so there's no moment when anyone but Brian could take it.
      room.localParticipant.setTrackSubscriptionPermissions(false, ONLY_BRIAN);
      this.permissionKey = JSON.stringify([false, ONLY_BRIAN]);
      await room.localParticipant.publishTrack(this.dest.stream.getAudioTracks()[0], {
        name: "voice",
        source: Track.Source.Microphone,
        dtx: false,
        audioPreset: AudioPresets.musicHighQuality,
      });
      this.set({ status: "connected", name: pass.name });
      this.refresh();
      await this.setPicture(this.state.picture);
    } catch (err) {
      const error = joinErrorMessage(err);
      await this.teardown();
      this.set({ status: "error", error });
    }
  }

  async leave() {
    if (this.room) await this.room.disconnect();
    else await this.teardown();
    if (this.state.status !== "error") this.set({ status: "ended" });
  }

  buildGraph() {
    const ctx = this.ctx;
    this.dest = ctx.createMediaStreamDestination();
    this.dest.channelCount = 1;
    this.sendGain = ctx.createGain(); // the kid's own sound; the delay test closes it
    this.sendGain.connect(this.dest);
    this.sendMeter = makeAnalyser(ctx);
    this.sendGain.connect(this.sendMeter);
    this.loopGain = ctx.createGain(); // Brian's sound, sent back when the mixer asks
    this.loopGain.gain.value = 0;
    this.loopGain.connect(this.dest);
    this.playBus = ctx.createGain(); // what this kid hears
    this.playBus.connect(ctx.destination);
  }

  // Swaps what this kid sends: the microphone or one of the test sounds. Works while connected.
  async setSound(kind) {
    if (!this.ctx) return;
    let source = null;
    let stream = null;
    let micError = "";
    if (kind === "mic") {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: SINGING_MIC });
        source = this.ctx.createMediaStreamSource(stream);
      } catch (err) {
        micError = micErrorMessage(err);
      }
    } else {
      const buffer = await renderTestSound(kind);
      if (!this.ctx || this.ctx.state === "closed") return;
      source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.start();
    }
    this.stopSource();
    this.source = source;
    this.sourceStream = stream;
    source?.connect(this.sendGain);
    this.set({ sound: kind, micError });
  }

  stopSource() {
    try {
      this.source?.stop?.();
    } catch {
      // never started
    }
    this.source?.disconnect();
    this.sourceStream?.getTracks().forEach((t) => t.stop());
    this.source = null;
    this.sourceStream = null;
  }

  // What this kid shows Brian: the camera, the test picture, or nothing.
  async setPicture(kind) {
    if (!this.room || this.state.status !== "connected") {
      this.set({ picture: kind });
      return;
    }
    await this.pictures.show(this.room, this.lk, kind, { name: this.state.name, tone: toneFor(this.state.name) });
    // A new picture is a new track, so the other kids' permission to see it is given again.
    this.refresh();
  }

  setSpeaker(on) {
    if (!this.ctx) return;
    glide(this.playBus.gain, on ? 1 : 0, this.ctx);
    this.set({ speakerOn: on });
  }

  wire(room) {
    const { RoomEvent, Track } = this.lk;
    const refresh = () => this.refresh();
    room
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, (p) => {
        this.dropTap(p.identity);
        this.videos.delete(p.identity);
        this.refresh();
      })
      .on(RoomEvent.TrackPublished, refresh)
      .on(RoomEvent.TrackUnpublished, (pub) => {
        this.wanted.delete(pub.trackSid);
        this.refresh();
      })
      .on(RoomEvent.ParticipantAttributesChanged, (_changed, p) => {
        if (p.identity === HOST_IDENTITY) this.refresh();
      })
      .on(RoomEvent.TrackSubscribed, (track, _pub, p) => {
        if (track.kind === Track.Kind.Audio) this.addTap(p, track);
        else if (track.kind === Track.Kind.Video) this.videos.set(p.identity, track);
        this.refresh();
      })
      .on(RoomEvent.TrackUnsubscribed, (track, _pub, p) => {
        if (track.kind === Track.Kind.Audio) this.dropTap(p.identity);
        else if (track.kind === Track.Kind.Video) this.videos.delete(p.identity);
        this.refresh();
      })
      .on(RoomEvent.Disconnected, (reason) => this.onDisconnected(reason));
  }

  addTap(p, track) {
    if (!this.ctx) return;
    this.dropTap(p.identity);
    const tap = tapRemoteTrack(this.ctx, track.mediaStreamTrack);
    tap.source.connect(this.playBus);
    // Brian's sound also feeds the send-back path, which stays shut until the mixer asks for it.
    if (p.identity === HOST_IDENTITY) tap.source.connect(this.loopGain);
    this.taps.set(p.identity, tap);
  }

  dropTap(identity) {
    this.taps.get(identity)?.stop();
    this.taps.delete(identity);
  }

  // Reads Brian's mixer and puts this page in line with it: what it sends, who may hear it, and
  // who it hears. Runs whenever anything in the room changes.
  refresh() {
    const room = this.room;
    if (!room || !this.ctx || this.state.status !== "connected") return;
    const host = room.remoteParticipants.get(HOST_IDENTITY);
    const attrs = host?.attributes ?? {};
    const me = this.myId;
    const stage = attrs[ATTR_STAGE] || "";
    const onStage = Boolean(host) && stage === me;
    const measuring = Boolean(host) && attrs[ATTR_MEASURING] === me;
    const withMusic = Boolean(host) && attrs[ATTR_WITH_MUSIC] === me && !onStage;
    const heardByBrian = Boolean(host) && (attrs[ATTR_LISTENING] === me || onStage);
    const galleryOn = Boolean(host) && attrs[ATTR_GALLERY] === "on";

    // What this kid sends. In the delay test their own sound goes quiet, so only the beep travels.
    glide(this.sendGain.gain, measuring ? 0 : 1, this.ctx);
    glide(this.loopGain.gain, measuring || withMusic ? 1 : 0, this.ctx);
    if (measuring && !this.state.measuring) this.send({ type: MSG_MEASURE_READY });

    this.updatePermissions(onStage, galleryOn);

    // What this kid receives: all of Brian, all of whoever else is on stage, and the other kids'
    // pictures, never their sound, while Brian lets kids see each other.
    const stageKid = onStage ? "" : stage;
    for (const p of room.remoteParticipants.values()) {
      const all = p.identity === HOST_IDENTITY || (Boolean(stageKid) && p.identity === stageKid);
      const otherKid = p.attributes?.role === "kid";
      for (const pub of p.trackPublications.values()) {
        const want = all || (galleryOn && otherKid && pub.kind === "video");
        if (this.wanted.get(pub.trackSid) !== want) {
          this.wanted.set(pub.trackSid, want);
          pub.setSubscribed(want);
        }
      }
    }

    const nameOf = (identity) => room.remoteParticipants.get(identity)?.name || "";
    const hearing = [...this.taps.keys()]
      .sort((a, b) => (a === HOST_IDENTITY ? -1 : b === HOST_IDENTITY ? 1 : 0))
      .map(nameOf)
      .filter(Boolean);
    this.set({
      hostHere: Boolean(host),
      hostName: host?.name || "Brian",
      heardByBrian,
      onStage,
      measuring,
      sendingBack: measuring || withMusic,
      stageName: stageKid ? nameOf(stageKid) : "",
      hearing,
      brianVideo: this.videos.get(HOST_IDENTITY) ?? null,
      stageVideo: stageKid ? (this.videos.get(stageKid) ?? null) : null,
      galleryOn,
      // The kid on stage is already shown big, so the gallery is everyone else.
      gallery: galleryOn
        ? [...room.remoteParticipants.values()]
            .filter((p) => p.attributes?.role === "kid" && p.identity !== stageKid)
            .map((p) => ({ identity: p.identity, name: p.name || "Kid", video: this.videos.get(p.identity) ?? null }))
        : [],
    });
  }

  // Who may receive this kid's tracks, enforced by the room server: Brian gets everything; on
  // stage, everyone does; otherwise each other kid gets only the picture, and only while Brian
  // lets kids see each other. Track permissions name tracks by id, so this is worked out again
  // whenever a kid comes or goes or this kid's picture changes, and sent only when it changes.
  updatePermissions(onStage, galleryOn) {
    const room = this.room;
    const pictureSid = this.pictures.out?.publication?.trackSid;
    let everyone = false;
    let allowed = ONLY_BRIAN;
    if (onStage) everyone = true;
    else if (galleryOn && pictureSid) {
      const kids = [...room.remoteParticipants.values()]
        .filter((p) => p.attributes?.role === "kid")
        .map((p) => p.identity)
        .sort();
      allowed = [...ONLY_BRIAN, ...kids.map((identity) => ({ participantIdentity: identity, allowedTrackSids: [pictureSid] }))];
    }
    const key = JSON.stringify([everyone, everyone ? [] : allowed]);
    if (key === this.permissionKey) return;
    this.permissionKey = key;
    room.localParticipant.setTrackSubscriptionPermissions(everyone, everyone ? [] : allowed);
  }

  send(message) {
    this.room?.localParticipant
      .publishData(encodeMessage(message), { reliable: true, destinationIdentities: [HOST_IDENTITY], topic: DATA_TOPIC })
      .catch((err) => console.warn("Live room test: couldn't reach the mixer", err));
  }

  onDisconnected(reason) {
    const { DisconnectReason } = this.lk;
    const error = reason === DisconnectReason.CLIENT_INITIATED ? "" : "The connection to the room ended.";
    this.teardown();
    this.set({ status: "ended", error });
  }

  async teardown() {
    if (this.ended) return;
    this.ended = true;
    this.stopSource();
    this.pictures.stop();
    this.videos.clear();
    for (const identity of [...this.taps.keys()]) this.dropTap(identity);
    this.room?.removeAllListeners();
    if (this.room && this.room.state !== "disconnected") await this.room.disconnect().catch(() => {});
    this.room = null;
    if (this.ctx && this.ctx.state !== "closed") await this.ctx.close().catch(() => {});
    this.set({
      hostHere: false,
      heardByBrian: false,
      onStage: false,
      measuring: false,
      sendingBack: false,
      hearing: [],
      brianVideo: null,
      stageVideo: null,
      selfVideo: null,
    });
  }
}
