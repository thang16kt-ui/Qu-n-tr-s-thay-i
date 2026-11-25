"use client";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/** Quét QR bằng camera sau (chạy được cả iPhone Safari) */
export default function Scanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const v = video.current!;
        v.srcObject = stream;
        v.setAttribute("playsinline", "true");
        await v.play();
        const tick = () => {
          if (stopped) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            const c = canvas.current!;
            const w = (c.width = v.videoWidth);
            const h = (c.height = v.videoHeight);
            const ctx = c.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0, w, h);
            const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
            if (code?.data) {
              stopped = true;
              navigator.vibrate?.(80);
              onResult(code.data);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setErr("Không mở được camera. Hãy cho phép quyền camera (cần HTTPS) hoặc nhập mã bằng tay.");
      }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <video ref={video} className="h-full w-full object-cover" muted />
      <canvas ref={canvas} className="hidden" />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="h-64 w-64 rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
      </div>
      {err && <p className="absolute inset-x-6 top-1/2 rounded-2xl bg-white p-4 text-center text-sm">{err}</p>}
      <button onClick={onClose} className="absolute inset-x-6 bottom-10 h-12 rounded-full bg-white font-bold text-bean-dark">Đóng camera</button>
    </div>
  );
}
