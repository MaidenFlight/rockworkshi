// The live room test's delay check (see lib/live/hostSession.js). Brian's mixer sends a short
// beep; the kid's page sends everything it hears straight back; this listens to that kid's track
// for the beep's return.
//
// For every 128-sample block inside the armed window, a Goertzel filter measures how much of the
// block's energy sits at the beep's frequency. A pure tone there scores about 1, music and noise
// close to 0. The first block where the beep dominates is the hit, and its context time goes back
// to the page.

class LivePingDetector extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const hz = options?.processorOptions?.hz ?? 2600;
    this.coeff = 2 * Math.cos((2 * Math.PI * hz) / sampleRate);
    this.from = Infinity;
    this.until = -Infinity;
    this.port.onmessage = (event) => {
      const { from, until } = event.data ?? {};
      this.from = typeof from === "number" ? from : Infinity;
      this.until = typeof until === "number" ? until : -Infinity;
    };
  }

  process(inputs) {
    const samples = inputs[0] && inputs[0][0];
    if (!samples || samples.length === 0) return true;
    const start = currentTime;
    const n = samples.length;
    if (start + n / sampleRate < this.from || start > this.until) return true;

    let s1 = 0;
    let s2 = 0;
    let energy = 0;
    for (let i = 0; i < n; i++) {
      const x = samples[i];
      const s0 = x + this.coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
      energy += x * x;
    }
    if (energy <= 0) return true;
    const power = s1 * s1 + s2 * s2 - this.coeff * s1 * s2;
    const share = power / ((energy * n) / 2);
    const rms = Math.sqrt(energy / n);
    if (share > 0.3 && rms > 0.01) {
      this.from = Infinity;
      this.port.postMessage({ time: start });
    }
    return true;
  }
}

registerProcessor("live-ping-detector", LivePingDetector);
