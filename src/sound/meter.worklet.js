// Dev only (PLAN-3.md 3.8): the level meter and click detector the ?debug
// panel hangs on each layer — the way to check levels and clicks without
// ears. Runs on the audio thread, so it sees every sample: RMS and peak in
// 100 ms windows, and a count of clicks.
//
// A click is a jump from one sample to the next far above what this signal
// has been doing (its running mean-square of differences), and above an
// absolute floor so quiet noise never counts. A heuristic, tuned to catch a
// gain set without a ramp on a running sound; a 128-sample refractory keeps
// one discontinuity from counting twice.

const FLOOR = 0.02;
const RATIO_SQ = 64; // 8× the running RMS of differences
const SMOOTH = 0.001;
const REFRACTORY = 128;

class Meter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sum = 0;
    this.count = 0;
    this.peak = 0;
    this.clicks = 0;
    this.prev = [];
    this.energy = [];
    this.quiet = 0;
    this.frames = 0;
  }

  process(inputs) {
    const channels = inputs[0] ?? [];
    for (let c = 0; c < channels.length; c++) {
      const data = channels[c];
      let prev = this.prev[c] ?? 0;
      let energy = this.energy[c] ?? 1e-6;
      for (let i = 0; i < data.length; i++) {
        const x = data[i];
        const a = Math.abs(x);
        if (a > this.peak) this.peak = a;
        this.sum += x * x;
        this.count++;
        const d = x - prev;
        prev = x;
        if (this.quiet > 0) this.quiet--;
        else if (Math.abs(d) > FLOOR && d * d > RATIO_SQ * energy) {
          this.clicks++;
          this.quiet = REFRACTORY;
        }
        energy += (d * d - energy) * SMOOTH;
      }
      this.prev[c] = prev;
      this.energy[c] = energy;
    }
    this.frames += 128;
    if (this.frames >= sampleRate / 10) {
      this.port.postMessage({
        rms: this.count ? Math.sqrt(this.sum / this.count) : 0,
        peak: this.peak,
        clicks: this.clicks
      });
      this.sum = 0;
      this.count = 0;
      this.peak = 0;
      this.frames = 0;
    }
    return true;
  }
}

registerProcessor('onirick-meter', Meter);
