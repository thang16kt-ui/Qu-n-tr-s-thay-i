"use client";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Quét QR bằng camera sau.
 * Dùng BarcodeDetector có sẵn của trình duyệt (Chrome Android, Edge…) — nhanh và nhẹ;
 * trình duyệt nào chưa có (Safari iPad/iPhone, Firefox) thì tự chuyển sang thư viện jsQR.
 */
export default function Scanner({ onResult, onClose, title }: {
  onResult: (text: string) => void; onClose: () => void; title?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [err, setErr] = useState("");
  const [engine, setEngine] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let busy = false;

    let detector: Detector | null = null;
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (BD) {
      try { detector = new BD({ formats: ["qr_code"] }); } catch { detector = null; }
    }
    setEngine(detector ? "BarcodeDetector" : "jsQR");

    const found = (text: string) => {
      if (stopped) return;
      stopped = true;
      navigator.vibrate?.(80);
      onResult(text);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
        });
        const v = video.current!;
        v.srcObject = stream;
        v.setAttribute("playsinline", "true");
        await v.play();
        const tick = async () => {
          if (stopped) return;
          if (!busy && v.readyState === v.HAVE_ENOUGH_DATA) {
            busy = true;
            try {
              if (detector) {
                const codes = await detector.detect(v);
                if (codes[0]?.rawValue) return found(codes[0].rawValue);
              } else {
                const c = canvas.current!;
                const scale = Math.min(1, 800 / v.videoWidth);
                const w = (c.width = Math.round(v.videoWidth * scale));
                const h = (c.height = Math.round(v.videoHeight * scale));
                const ctx = c.getContext("2d", { willReadFrequently: true })!;
                ctx.drawImage(v, 0, 0, w, h);
                const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
                if (code?.data) return found(code.data);
              }
            } catch {
              detector = null; // BarcodeDetector lỗi → dùng jsQR
            } finally {
              busy = false;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setErr("Không mở được camera. Hãy cho phép quyền camera (trang phải chạy HTTPS) hoặc nhập SĐT bằng tay.");
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
      <div className="absolute inset-x-0 top-6 text-center text-sm font-semibold text-white/90">
        {title ?? "Đưa mã QR vào khung"}{engine && <span className="ml-2 text-white/50">· {engine}</span>}
      </div>
      {err && <p className="absolute inset-x-6 top-1/2 mx-auto max-w-md rounded-2xl bg-white p-4 text-center text-sm">{err}</p>}
      <button onClick={onClose} className="absolute inset-x-6 bottom-10 mx-auto h-12 max-w-md rounded-full bg-white font-bold text-bean-dark">Đóng camera</button>
    </div>
  );
}
