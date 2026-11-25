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
