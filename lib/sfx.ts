// lib/sfx.ts — game sounds synthesized with Web Audio. No asset files, so
// nothing to license: every effect is oscillators shaped by an envelope.
// Pitches/durations were matched by ear-analysis of a reference set.
export type Sfx = "tick" | "cancel" | "correct" | "win";

const KEY = "sq_volume";
export const DEFAULT_VOLUME = 0.6;

export function getVolume(): number {
  // Unset reads as null, and Number(null) is a perfectly in-range 0 — so check
  // for the key itself, or a first-time player would land on muted.
  const raw = localStorage.getItem(KEY);
  const v = Number(raw);
  return raw !== null && v >= 0 && v <= 1 ? v : DEFAULT_VOLUME;
}

export function setVolume(v: number) {
  localStorage.setItem(KEY, String(v));
}

let ctx: AudioContext | undefined;
let master: GainNode | undefined;

type ToneOpts = {
  type?: OscillatorType;
  at?: number; // start offset in seconds
  dur?: number;
  gain?: number;
  to?: number; // sweep the pitch to this by the end
};

function tone(f: number, { type = "sine", at = 0, dur = 0.3, gain = 1, to }: ToneOpts = {}) {
  const c = ctx!;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  // Ramp in over a few ms: jumping straight to full gain pops.
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master!);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// Band-limited noise burst — the broadband transient that makes a tap read as a
// tap rather than a beep. Oscillators alone can't produce it.
function noise(gain: number, freq: number, dur: number) {
  const c = ctx!;
  const t = c.currentTime;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  const env = c.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(env).connect(master!);
  src.start(t);
}

const SOUNDS: Record<Sfx, (step: number) => void> = {
  // Letter tap. The reference clicks fall 20dB inside 10ms with their energy
  // spread from 60Hz to 1.6kHz — a wooden knock, not a note. The four of them
  // barely differ in pitch, so this rotates variants instead of climbing a scale.
  tick: (step) => {
    const v = step % 4;
    noise(0.16, 900 + v * 120, 0.025);
    tone(470 + v * 14, { dur: 0.05, gain: 0.22 });
    tone(104 + v * 5, { dur: 0.07, gain: 0.26, to: 62 });
  },
  // Rejection: a low buzz on 183Hz and its octave, holding pitch as it decays.
  cancel: () => {
    tone(183, { type: "square", dur: 0.5, gain: 0.22 });
    tone(366, { type: "triangle", dur: 0.35, gain: 0.12 });
    tone(94, { dur: 0.45, gain: 0.16 });
  },
  // Word found: a soft C-major arpeggio, E4 up to C6, ringing out. Deliberately
  // quiet and free of high partials — this one fires constantly.
  correct: () => {
    tone(330, { dur: 0.9, gain: 0.16 });
    tone(660, { at: 0.02, dur: 0.5, gain: 0.05 });
    tone(392, { at: 0.1, dur: 0.75, gain: 0.11 });
    tone(523, { at: 0.13, dur: 0.7, gain: 0.12 });
    tone(784, { at: 0.24, dur: 0.55, gain: 0.07 });
    tone(1047, { at: 0.27, dur: 0.45, gain: 0.05 });
  },
  // Board cleared: an E-flat major run into a held chord, every note doubled an
  // octave up the way the reference fanfare is.
  win: () => {
    const run: [number, number, number][] = [
      // pitch, start, length
      [311, 0, 0.4],
      [349, 0.4, 0.16],
      [392, 0.56, 0.24],
      [415, 0.8, 0.14],
      [466, 0.94, 0.34],
    ];
    for (const [f, at, dur] of run) {
      tone(f, { type: "triangle", at, dur, gain: 0.2 });
      tone(f * 2, { at, dur: dur * 0.8, gain: 0.07 });
    }
    [622, 784, 932, 1244].forEach((f, i) =>
      tone(f, { type: "triangle", at: 1.28, dur: 1.9, gain: 0.15 - i * 0.03 })
    );
  },
};

export function play(name: Sfx, step = 0) {
  if (typeof window === "undefined") return;
  // ponytail: volume re-read per play — one localStorage hit, no state to sync
  const volume = getVolume();
  if (!volume) return;
  ctx ??= new AudioContext();
  if (!master) {
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  master.gain.value = volume;
  // Browsers suspend the context until a gesture, and again on tab blur.
  if (ctx.state === "suspended") ctx.resume();
  SOUNDS[name](step);
}
