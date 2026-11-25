"use client";
// Âm báo "ting ting" bằng Web Audio (không cần file mp3).
// Trình duyệt chỉ cho phát âm thanh sau khi người dùng đã chạm vào trang,
// nên ta "mở khoá" AudioContext ở lần chạm đầu tiên.
let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    if (ctx?.state === "suspended") ctx.resume();
  } catch {}
}

export function chime() {
  try {
    unlockAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [880, 1175, 1568].forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = t0 + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
}

/** Âm thanh đã được trình duyệt cho phép chưa (cần 1 lần chạm vào trang) */
export function audioReady(): boolean {
  return !!ctx && ctx.state === "running";
}

function tones(list: { f: number; at: number; dur: number; type?: OscillatorType; vol?: number }[]) {
  try {
    unlockAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (const n of list) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = n.type ?? "sine";
      o.frequency.value = n.f;
      const t = t0 + n.at;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(n.vol ?? 0.3, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + n.dur + 0.05);
    }
  } catch {}
}

/** "Bíp" khi quét mã đúng */
export const beep = () => tones([{ f: 1760, at: 0, dur: 0.12, type: "square", vol: 0.18 }]);

/** Âm báo lỗi (mã sai / đơn đã xác nhận) */
export const buzz = () =>
  tones([
    { f: 196, at: 0, dur: 0.18, type: "sawtooth", vol: 0.22 },
    { f: 165, at: 0.2, dur: 0.28, type: "sawtooth", vol: 0.22 },
  ]);

/** Chuông báo bếp có đơn mới (ding-dong 2 lần) */
export const bell = () =>
  tones([
    { f: 1318, at: 0, dur: 0.5, vol: 0.35 }, { f: 988, at: 0.32, dur: 0.7, vol: 0.35 },
    { f: 1318, at: 1.0, dur: 0.5, vol: 0.35 }, { f: 988, at: 1.32, dur: 0.7, vol: 0.35 },
  ]);
