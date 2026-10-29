// Small synthesized sound effects (no audio files). Off until the first key or tap
// because browsers only allow audio after a user gesture.
let audio: AudioContext | null = null;
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

function tone(frequency: number, seconds: number, type: OscillatorType, volume: number, delay = 0): void {
  if (muted || !audio) return;
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + seconds);
}

export const sfx = {
  move: () => tone(220, 0.03, "square", 0.025),
  rotate: () => tone(330, 0.04, "square", 0.03),
  lock: () => tone(110, 0.08, "triangle", 0.12),
  clear: () => tone(523, 0.12, "square", 0.05),
  tetris: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, "square", 0.05, i * 0.07)),
  level: () => [392, 523].forEach((f, i) => tone(f, 0.12, "triangle", 0.1, i * 0.08)),
  over: () => [330, 262, 196].forEach((f, i) => tone(f, 0.25, "sawtooth", 0.05, i * 0.18)),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, "square", 0.05, i * 0.09)),
};
