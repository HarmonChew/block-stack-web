// Chip-style sound effects synthesized on the fly: pulse waves, a triangle and a
// noise channel, like an 8-bit console has, playing our own little cues.
// Off until the first key or tap, because browsers only allow audio after a gesture.
let audio: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
const pulses = new Map<number, PeriodicWave>();
let muted = localStorage.getItem("bsa.muted") === "1";

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  localStorage.setItem("bsa.muted", value ? "1" : "0");
}

export function unlockAudio(): void {
  audio ??= new AudioContext();
  if (audio.state === "suspended") void audio.resume();
}

/** A pulse wave with the given duty cycle (0.125, 0.25 or 0.5). */
function pulseWave(context: AudioContext, duty: number): PeriodicWave {
  let wave = pulses.get(duty);
  if (!wave) {
    const harmonics = 32;
    const real = new Float32Array(harmonics);
    const imag = new Float32Array(harmonics);
    for (let n = 1; n < harmonics; n++) {
      real[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI);
      imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI);
    }
    wave = context.createPeriodicWave(real, imag);
    pulses.set(duty, wave);
  }
  return wave;
}

function envelope(context: AudioContext, start: number, seconds: number, volume: number): GainNode {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  gain.connect(context.destination);
  return gain;
}

function tone(kind: "pulse" | "triangle", frequency: number, seconds: number, volume: number,
              delay = 0, duty = 0.5, slideTo = 0): void {
  if (muted || !audio) return;
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  if (kind === "pulse") oscillator.setPeriodicWave(pulseWave(audio, duty));
  else oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, start);
  if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
  oscillator.connect(envelope(audio, start, seconds, volume));
  oscillator.start(start);
  oscillator.stop(start + seconds + 0.02);
}

function noise(seconds: number, volume: number, delay: number, cutoff: number, high = false): void {
  if (muted || !audio) return;
  if (!noiseBuffer) {
    noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const start = audio.currentTime + delay;
  const source = audio.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = audio.createBiquadFilter();
  filter.type = high ? "highpass" : "lowpass";
  filter.frequency.setValueAtTime(cutoff, start);
  source.connect(filter).connect(envelope(audio, start, seconds, volume));
  source.start(start);
  source.stop(start + seconds + 0.02);
}

const pulse = (frequency: number, seconds: number, volume: number, delay = 0, duty = 0.5, slideTo = 0) =>
  tone("pulse", frequency, seconds, volume, delay, duty, slideTo);
const triangle = (frequency: number, seconds: number, volume: number, delay = 0, slideTo = 0) =>
  tone("triangle", frequency, seconds, volume, delay, 0.5, slideTo);
const run = (notes: number[], step: number, play: (frequency: number, delay: number) => void) =>
  notes.forEach((frequency, i) => play(frequency, i * step));

export const sfx = {
  move: () => pulse(1760, 0.025, 0.035, 0, 0.125),
  rotate: () => pulse(990, 0.05, 0.04, 0, 0.25, 1480),
  lock: () => {
    noise(0.07, 0.16, 0, 1400);
    triangle(98, 0.06, 0.22);
  },
  clear: (lines: number) => {
    run([784, 988, 1175, 1397].slice(0, lines + 1), 0.045, (f, d) => pulse(f, 0.06, 0.045, d));
    noise(0.22, 0.05, 0.02, 3000, true);
  },
  tetris: () => {
    run([523, 659, 784, 1047, 1319, 1568], 0.04, (f, d) => pulse(f, 0.07, 0.05, d, 0.25));
    noise(0.4, 0.09, 0.05, 5000, true);
    triangle(131, 0.32, 0.25, 0.04);
  },
  level: () => run([392, 494, 587, 784], 0.06, (f, d) => triangle(f, 0.1, 0.3, d)),
  over: () => {
    pulse(660, 0.75, 0.05, 0, 0.5, 82);
    noise(0.5, 0.08, 0.1, 600);
  },
  win: () => {
    const notes: [number, number][] = [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.24], [988, 0.1], [1047, 0.42]];
    let at = 0;
    for (const [frequency, length] of notes) {
      pulse(frequency, length + 0.04, 0.05, at, 0.25);
      at += length;
    }
    run([131, 196, 262], 0.2, (f, d) => triangle(f, 0.22, 0.25, d));
  },
  lose: () => {
    run([392, 370, 349], 0.18, (f, d) => pulse(f, 0.16, 0.04, d));
    pulse(330, 0.5, 0.04, 0.54);
    triangle(82, 0.7, 0.25, 0.54);
  },
  count: () => pulse(659, 0.09, 0.05),
  go: () => {
    pulse(1319, 0.22, 0.05, 0, 0.25);
    triangle(330, 0.22, 0.25);
  },
  menuMove: () => pulse(1319, 0.03, 0.035, 0, 0.125),
  menuSelect: () => {
    pulse(880, 0.05, 0.045, 0, 0.25);
    pulse(1319, 0.09, 0.045, 0.05, 0.25);
  },
  menuBack: () => {
    pulse(988, 0.05, 0.04, 0, 0.25);
    pulse(659, 0.08, 0.04, 0.05, 0.25);
  },
  land: () => noise(0.035, 0.05, 0, 2200),
};
