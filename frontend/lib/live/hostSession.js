import { analyser as makeAnalyser } from "@/lib/audio/meters";
import {
  ATTR_GALLERY,
  ATTR_LISTENING,
  ATTR_MEASURING,
  ATTR_STAGE,
  ATTR_WITH_MUSIC,
  DATA_TOPIC,
  MSG_MEASURE_READY,
  PING_HZ,
  decodeMessage,
} from "./protocol";
import { SINGING_MIC, fetchRoomPass, glide, joinErrorMessage, median, micErrorMessage, tapRemoteTrack } from "./roomAudio";
import { renderTestSound } from "./testSounds";
import { PictureSender } from "./video";

const BEEPS = 3; // the delay test times this many beeps and keeps the middle result
const BEEP_WINDOW_S = 1.2; // how long after each beep to listen for it coming back
const CLICK_LEVEL = 0.8;

// Brian's side of the live room test: the mixer.
//
// The mixer sends one stereo track, built in its own audio graph: Brian's mic (when it's on), the
// click and a song, through a "duck" that the delay test turns down, plus the delay test's beep.
// The click and the song also play locally, at once, so Brian can play and sing to them.
//
// Every kid's track comes in all the time (it's only audio, a few dozen kilobits each) and runs
// into a meter and a gain that stays shut until Brian picks that kid. Switching just opens one
// gain and closes another, so it's instant: nothing has to go to the server and back.
export class HostSession {
  constructor() {
    this.listeners = new Set();
    this.state = {
      status: "idle", // idle | connecting | connected | ended | error
      error: "",
      name: "Brian",
      kids: [], // { identity, name, sound, volume, hasAudio, video, rtt, rttNote }
      listening: "", // the kid Brian picked
      stage: "", // the kid everyone hears
      withMusic: false, // the picked kid sends their voice mixed with what they hear
      gallery: false, // kids see each other's pictures (never hear each other); off until Brian turns it on
      micOn: false,
      micError: "",
      clickOn: false, // the metronome waits until Brian turns it on
      bpm: 100,
      measuring: "",
      picture: "camera", // camera | test | off
      quality: "720", // 540 | 720, the size Brian's picture goes out at
      pictureKbps: 0, // what the picture is sending now, measured
      pictureError: "",
      selfVideo: null, // Brian's own picture, for the preview
      selfMirror: false,
      songs: [], // { id, title } from /api/live-test/songs
      songsNote: "",
      song: "", // the chosen song's id
      songPlaying: false,
      songTime: 0,
      songLength: 0,
      songVolume: 0.8,
      songError: "",
    };
    this.pictures = new PictureSender((patch) => this.set(patch));
    this.kidAudio = new Map(); // identity -> { tap, gain, meter }
    this.waiters = new Map();
    this.room = null;
    this.ctx = null;
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

  updateKid(identity, patch) {
    this.set({ kids: this.state.kids.map((k) => (k.identity === identity ? { ...k, ...patch } : k)) });
  }

  getKidMeter(identity) {
    return this.kidAudio.get(identity)?.meter ?? null;
  }

  getSendMeter() {
    return this.sendMeter ?? null;
  }

  // Call this from the click that joins: browsers only let a page start sound inside a click.
  // getPass: where the room pass comes from (a real meeting asks the site); the test room by default.
  async join({ name, passcode, picture = "camera", getPass = null }) {
    if (this.state.status !== "idle") return;
    this.set({ status: "connecting", error: "", picture });
    try {
      this.ctx = new AudioContext({ latencyHint: "interactive" });
      const resumed = this.ctx.resume();
      this.lk = await import("livekit-client");
      await resumed;
      await this.buildSendGraph();
      const pass = getPass ? await getPass() : await fetchRoomPass({ role: "host", name, passcode });
      const { Room, Track, AudioPresets } = this.lk;
      // adaptiveStream sends each video at the size it's shown (small for the mixer's tiles) and
      // pauses video nobody can see; dynacast stops sending sizes nobody is watching.
      const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });
      this.room = room;
      this.wire(room);
      await room.connect(pass.url, pass.token, { autoSubscribe: true });
      await room.localParticipant.publishTrack(this.dest.stream.getAudioTracks()[0], {
        name: "brian",
        source: Track.Source.Microphone,
        dtx: false,
        forceStereo: true,
        audioPreset: AudioPresets.musicHighQualityStereo,
      });
      for (const p of room.remoteParticipants.values()) this.addKid(p);
      this.set({ status: "connected", name: pass.name });
      await this.publishAttributes();
      await this.setPicture(this.state.picture);
      await this.loadSongs();
      this.rateTimer = setInterval(() => this.readPictureRate(), 2000);
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

  wire(room) {
    const { RoomEvent, Track } = this.lk;
    room
      .on(RoomEvent.ParticipantConnected, (p) => this.addKid(p))
      .on(RoomEvent.ParticipantDisconnected, (p) => this.removeKid(p.identity))
      .on(RoomEvent.TrackSubscribed, (track, _pub, p) => {
        if (track.kind === Track.Kind.Audio) this.attachKid(p, track);
        else if (track.kind === Track.Kind.Video) this.showKid(p, track);
      })
      .on(RoomEvent.TrackUnsubscribed, (track, _pub, p) => {
        if (track.kind === Track.Kind.Audio) this.detachKid(p.identity);
        else if (track.kind === Track.Kind.Video) this.showKid(p, null);
      })
      .on(RoomEvent.DataReceived, (payload, p, _kind, topic) => {
        if (topic === DATA_TOPIC && p) this.onMessage(p.identity, decodeMessage(payload));
      })
      .on(RoomEvent.Disconnected, (reason) => this.onDisconnected(reason));
  }

  // ---- What Brian sends ----

  async buildSendGraph() {
    const ctx = this.ctx;
    // Stereo, so a song keeps its width; the mic and the click sit in the middle.
    this.dest = ctx.createMediaStreamDestination();
    this.dest.channelCount = 2;
    this.sendBus = ctx.createGain();
    this.sendBus.connect(this.dest);
    this.sendMeter = makeAnalyser(ctx);
    this.sendBus.connect(this.sendMeter);
    this.duck = ctx.createGain();
    this.duck.connect(this.sendBus);
    this.micGain = ctx.createGain();
    this.micGain.gain.value = 0;
    this.micGain.connect(this.duck);
    this.clickGain = ctx.createGain();
    this.clickGain.gain.value = this.state.clickOn ? CLICK_LEVEL : 0;
    this.clickGain.connect(this.duck);
    // What Brian hears of the mixer's own sound, straight away: the click and the song.
    this.localMonitor = ctx.createGain();
    this.localMonitor.connect(ctx.destination);
    this.clickGain.connect(this.localMonitor);
    this.buildSongPlayer();
    await this.restartClick();
  }

  // A song plays from an <audio> element routed into the graph, so it can pause and seek like any
  // player, and the delay test's duck turns it down along with the mic and the click.
  buildSongPlayer() {
    const audio = new Audio();
    audio.preload = "auto";
    this.songEl = audio;
    this.songGain = this.ctx.createGain();
    this.songGain.gain.value = this.state.songVolume;
    this.ctx.createMediaElementSource(audio).connect(this.songGain);
    this.songGain.connect(this.duck);
    this.songGain.connect(this.localMonitor);
    audio.addEventListener("loadedmetadata", () => this.set({ songLength: Number.isFinite(audio.duration) ? audio.duration : 0 }));
    audio.addEventListener("timeupdate", () => this.set({ songTime: audio.currentTime }));
    audio.addEventListener("play", () => this.set({ songPlaying: true }));
    audio.addEventListener("pause", () => this.set({ songPlaying: false }));
    audio.addEventListener("ended", () => {
      audio.currentTime = 0;
      this.set({ songPlaying: false, songTime: 0 });
    });
    audio.addEventListener("error", () => {
      if (audio.getAttribute("src")) this.set({ songPlaying: false, songError: "That song didn't load." });
    });
  }

  async loadSongs() {
    try {
      const res = await fetch("/api/live-test/songs", { cache: "no-store" });
      const data = await res.json();
      this.set({ songs: data.songs ?? [], songsNote: data.note ?? "" });
    } catch {
      this.set({ songs: [], songsNote: "Couldn't load the song list." });
    }
  }

  chooseSong(id) {
    const audio = this.songEl;
    if (!audio) return;
    audio.pause();
    if (id) audio.src = `/api/live-test/songs?play=${encodeURIComponent(id)}`;
    else audio.removeAttribute("src");
    audio.load();
    this.set({ song: id, songPlaying: false, songTime: 0, songLength: 0, songError: "" });
  }

  // Playing a song turns the click off, since the song has its own beat. The mic stays as Brian
  // left it: on to sing or talk over the song, off to send the song by itself.
  async playSong() {
    if (!this.songEl || !this.state.song) return;
    if (this.state.clickOn) this.setClick(false);
    try {
      await this.songEl.play();
    } catch {
      this.set({ songError: "The song wouldn't start." });
    }
  }

  pauseSong() {
    this.songEl?.pause();
  }

  stopSong() {
    if (!this.songEl) return;
    this.songEl.pause();
    this.songEl.currentTime = 0;
    this.set({ songTime: 0 });
  }

  seekSong(seconds) {
    if (this.songEl && Number.isFinite(seconds)) this.songEl.currentTime = seconds;
  }

  setSongVolume(volume) {
    if (this.ctx) glide(this.songGain.gain, volume, this.ctx);
    this.set({ songVolume: volume });
  }

  async restartClick() {
    const buffer = await renderTestSound("click", { bpm: this.state.bpm });
    if (!this.ctx || this.ctx.state === "closed") return;
    try {
      this.clickSource?.stop();
    } catch {
      // never started
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(this.clickGain);
    src.start();
    this.clickSource = src;
  }

  setClick(on) {
    if (!this.ctx) return;
    glide(this.clickGain.gain, on ? CLICK_LEVEL : 0, this.ctx);
    this.set({ clickOn: on });
  }

  async setBpm(bpm) {
    const next = Math.max(50, Math.min(180, Math.round(bpm)));
    if (next === this.state.bpm) return;
    this.set({ bpm: next });
    if (this.ctx) await this.restartClick();
  }

  async setMic(on) {
    if (!this.ctx) return;
    if (!on) {
      this.stopMic();
      this.set({ micOn: false });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: SINGING_MIC });
      this.stopMic();
      this.micStream = stream;
      this.micSource = this.ctx.createMediaStreamSource(stream);
      this.micSource.connect(this.micGain);
      glide(this.micGain.gain, 1, this.ctx);
      this.set({ micOn: true, micError: "" });
    } catch (err) {
      this.set({ micOn: false, micError: micErrorMessage(err) });
    }
  }

  stopMic() {
    if (this.ctx && this.micGain) glide(this.micGain.gain, 0, this.ctx);
    this.micSource?.disconnect();
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micSource = null;
    this.micStream = null;
  }

  // What Brian shows every kid: the camera, the test picture, or nothing.
  async setPicture(kind) {
    if (!this.room || this.state.status !== "connected") {
      this.set({ picture: kind });
      return;
    }
    await this.pictures.show(this.room, this.lk, kind, { name: this.state.name, tone: "--rw-gold" }, this.state.quality);
  }

  // The size Brian's picture goes out at. A new size means sending the picture again.
  async setQuality(id) {
    if (id === this.state.quality) return;
    this.set({ quality: id });
    if (this.room && this.state.status === "connected" && this.state.picture !== "off") await this.setPicture(this.state.picture);
  }

  // What a kid watching Brian full size receives, from the browser's own counters, in kilobits a
  // second. Brian also sends smaller layers (360p, 180p) for small screens, but each kid receives
  // only one layer and LiveKit counts what kids receive, so this reads the biggest layer alone.
  async readPictureRate() {
    const track = this.pictures.out?.publication?.track;
    if (!track?.getSenderStats) {
      this.lastSent = null;
      if (this.state.pictureKbps) this.set({ pictureKbps: 0 });
      return;
    }
    try {
      const layers = await track.getSenderStats();
      const top = layers.find((l) => l.rid === "f") ?? layers.reduce((a, b) => ((b.frameWidth || 0) >= (a?.frameWidth || 0) ? b : a), null);
      if (!top) return;
      const now = performance.now();
      const last = this.lastSent;
      this.lastSent = { bytes: top.bytesSent || 0, at: now, track, rid: top.rid };
      if (!last || last.track !== track || last.rid !== top.rid || now <= last.at) return;
      const kbps = Math.max(0, Math.round((((top.bytesSent || 0) - last.bytes) * 8) / (now - last.at)));
      if (kbps !== this.state.pictureKbps) this.set({ pictureKbps: kbps });
    } catch {
      // the stats aren't ready yet
    }
  }

  // ---- The kids ----

  addKid(p) {
    if (p.attributes?.role !== "kid" || this.state.kids.some((k) => k.identity === p.identity)) return;
    const kid = {
      identity: p.identity,
      name: p.name || "Kid",
      sound: p.attributes?.sound ?? "",
      volume: 1,
      hasAudio: false,
      video: null,
      rtt: null,
      rttNote: "",
    };
    this.set({ kids: [...this.state.kids, kid] });
  }

  // A kid's picture, for their strip. Only Brian receives it, unless the kid is on stage.
  showKid(p, track) {
    this.addKid(p);
    if (this.state.kids.some((k) => k.identity === p.identity)) this.updateKid(p.identity, { video: track });
  }

  removeKid(identity) {
    this.detachKid(identity);
    const { listening, stage } = this.state;
    this.set({
      kids: this.state.kids.filter((k) => k.identity !== identity),
      listening: listening === identity ? "" : listening,
      stage: stage === identity ? "" : stage,
    });
    if (listening === identity || stage === identity) this.publishAttributes();
  }

  attachKid(p, track) {
    if (!this.ctx) return;
    this.addKid(p);
    this.detachKid(p.identity);
    const tap = tapRemoteTrack(this.ctx, track.mediaStreamTrack);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const meter = makeAnalyser(this.ctx);
    tap.source.connect(meter);
    tap.source.connect(gain).connect(this.ctx.destination);
    this.kidAudio.set(p.identity, { tap, gain, meter });
    this.updateKid(p.identity, { hasAudio: true });
    this.applyMix();
  }

  detachKid(identity) {
    const audio = this.kidAudio.get(identity);
    if (!audio) return;
    audio.tap.stop();
    audio.gain.disconnect();
    this.kidAudio.delete(identity);
    if (this.state.kids.some((k) => k.identity === identity)) this.updateKid(identity, { hasAudio: false });
  }

  // The mixer plays the picked kid and whoever is on stage, and nobody else.
  applyMix() {
    if (!this.ctx) return;
    const { listening, stage, withMusic, kids } = this.state;
    for (const kid of kids) {
      const audio = this.kidAudio.get(kid.identity);
      if (!audio) continue;
      const open = kid.identity === listening || kid.identity === stage;
      glide(audio.gain.gain, open ? kid.volume : 0, this.ctx);
    }
    // While a kid sends the music back, Brian's own click and song would sound twice: here, and
    // late in that kid's mix. So the local copy goes quiet; the kid's is the one in time with them.
    const fromKid = withMusic && listening && listening !== stage;
    glide(this.localMonitor.gain, fromKid ? 0 : 1, this.ctx);
  }

  listenTo(identity) {
    if (this.state.status !== "connected") return;
    this.set({ listening: identity || "" });
    this.applyMix();
    this.publishAttributes();
  }

  listenToNumber(n) {
    const kid = this.state.kids[n - 1];
    if (kid) this.listenTo(kid.identity);
  }

  toggleStage(identity) {
    if (this.state.status !== "connected") return;
    this.set({ stage: this.state.stage === identity ? "" : identity });
    this.applyMix();
    this.publishAttributes();
  }

  setWithMusic(on) {
    this.set({ withMusic: on });
    this.applyMix();
    this.publishAttributes();
  }

  // Whether the kids see each other's pictures. Their sound stays private either way.
  setGallery(on) {
    this.set({ gallery: on });
    this.publishAttributes();
  }

  setVolume(identity, volume) {
    this.updateKid(identity, { volume });
    this.applyMix();
  }

  // The kids' pages read these to know who Brian hears, who's on stage and when to send the
  // music back.
  async publishAttributes() {
    const room = this.room;
    if (!room || this.state.status !== "connected") return;
    const { listening, stage, withMusic, measuring, gallery } = this.state;
    try {
      await room.localParticipant.setAttributes({
        [ATTR_LISTENING]: listening,
        [ATTR_STAGE]: stage,
        [ATTR_WITH_MUSIC]: withMusic && listening !== stage ? listening : "",
        [ATTR_MEASURING]: measuring,
        [ATTR_GALLERY]: gallery ? "on" : "",
      });
    } catch (err) {
      console.warn("Live room test: couldn't update the room", err);
    }
  }

  // ---- The delay test ----
  //
  // The kid's page goes quiet and sends back everything it hears; Brian's click and mic duck, so
  // the only thing travelling is the beep. The time from sending a beep to hearing it come back
  // is the whole trip: Brian to the server, to the kid, through their page, and back again.
  async measure(identity) {
    if (this.state.measuring || this.state.status !== "connected") return;
    const audio = this.kidAudio.get(identity);
    if (!audio) {
      this.updateKid(identity, { rtt: null, rttNote: "No sound from this kid yet." });
      return;
    }
    this.updateKid(identity, { rtt: null, rttNote: "Measuring…" });
    this.set({ measuring: identity });
    let rtt = null;
    let note = "";
    try {
      const detector = await this.ensureDetector();
      audio.tap.source.connect(detector);
      const ready = this.waitForMessage(identity, MSG_MEASURE_READY, 4000);
      await this.publishAttributes();
      await ready;
      glide(this.duck.gain, 0, this.ctx);
      const trips = [];
      for (let i = 0; i < BEEPS; i++) {
        const at = this.ctx.currentTime + 0.3;
        const heard = this.listenForBeep(at, at + BEEP_WINDOW_S);
        this.beep(at);
        const back = await heard;
        if (back !== null) trips.push(back - at);
      }
      if (trips.length) rtt = median(trips);
      else note = "The beep didn't come back.";
    } catch (err) {
      note = err?.message || "The delay test didn't finish.";
    } finally {
      // Named, so only this one connection goes: disconnect() with no node would cut the kid off.
      if (this.detector) {
        try {
          audio.tap.source.disconnect(this.detector);
        } catch {
          // the kid left, or the detector never connected
        }
      }
      if (this.ctx && this.ctx.state !== "closed") glide(this.duck.gain, 1, this.ctx);
      if (this.state.kids.some((k) => k.identity === identity)) this.updateKid(identity, { rtt, rttNote: note });
      this.set({ measuring: "" });
      await this.publishAttributes();
    }
  }

  async ensureDetector() {
    if (this.detector) return this.detector;
    await this.ctx.audioWorklet.addModule("/live/ping-detector.js");
    const node = new AudioWorkletNode(this.ctx, "live-ping-detector", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { hz: PING_HZ },
    });
    // The detector has to be pulled by the graph to run; it reaches the speakers through silence.
    const silent = this.ctx.createGain();
    silent.gain.value = 0;
    node.connect(silent).connect(this.ctx.destination);
    node.port.onmessage = (event) => this.onBeepHeard?.(event.data?.time);
    this.detector = node;
    return node;
  }

  listenForBeep(from, until) {
    return new Promise((resolve) => {
      const done = (time) => {
        clearTimeout(timer);
        this.onBeepHeard = null;
        this.detector.port.postMessage({ from: Infinity, until: -Infinity });
        resolve(time);
      };
      const timer = setTimeout(() => done(null), (until - this.ctx.currentTime) * 1000 + 100);
      this.onBeepHeard = (time) => done(typeof time === "number" ? time : null);
      this.detector.port.postMessage({ from, until });
    });
  }

  beep(at) {
    const osc = this.ctx.createOscillator();
    osc.frequency.value = PING_HZ;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.5, at + 0.003);
    env.gain.setValueAtTime(0.5, at + 0.047);
    env.gain.linearRampToValueAtTime(0, at + 0.05);
    osc.connect(env).connect(this.sendBus);
    osc.start(at);
    osc.stop(at + 0.06);
  }

  waitForMessage(identity, type, ms) {
    const key = `${identity}:${type}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(key);
        reject(new Error("That kid's page didn't answer. Is it still open?"));
      }, ms);
      this.waiters.set(key, () => {
        clearTimeout(timer);
        this.waiters.delete(key);
        resolve();
      });
    });
  }

  onMessage(identity, message) {
    if (message?.type) this.waiters.get(`${identity}:${message.type}`)?.();
  }

  // ---- Leaving ----

  onDisconnected(reason) {
    const { DisconnectReason } = this.lk;
    let error = "";
    if (reason === DisconnectReason.DUPLICATE_IDENTITY) error = "Another tab opened the mixer, so this one left the room.";
    else if (reason !== DisconnectReason.CLIENT_INITIATED) error = "The connection to the room ended.";
    this.teardown();
    this.set({ status: "ended", error });
  }

  async teardown() {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.rateTimer);
    this.stopMic();
    this.pictures.stop();
    if (this.songEl) {
      this.songEl.pause();
      this.songEl.removeAttribute("src");
    }
    for (const identity of [...this.kidAudio.keys()]) this.detachKid(identity);
    try {
      this.clickSource?.stop();
    } catch {
      // never started
    }
    this.room?.removeAllListeners();
    if (this.room && this.room.state !== "disconnected") await this.room.disconnect().catch(() => {});
    this.room = null;
    if (this.ctx && this.ctx.state !== "closed") await this.ctx.close().catch(() => {});
    this.set({ kids: [], listening: "", stage: "", measuring: "", selfVideo: null });
  }
}
