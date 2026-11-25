"use client";
import { useEffect, useState } from "react";
import Sheet from "./Sheet";
import { IShare, IPlus } from "./Icons";
import { isIOS, isStandalone } from "@/lib/push";
import { LogoMark } from "./Logo";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };
let deferred: BIP | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BIP; });
}

/** Hướng dẫn "Thêm vào màn hình chính" (iPhone) / nút cài app (Android, Chrome) */
export default function InstallGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [ios, setIos] = useState(true);
  const [installed, setInstalled] = useState(false);
  useEffect(() => { setIos(isIOS()); setInstalled(isStandalone()); }, [open]);

  const steps = [
    { icon: <span className="text-lg">🧭</span>, text: <>Mở trang này bằng <b>Safari</b> (không dùng Chrome hay Zalo/Facebook).</> },
    { icon: <IShare size={20} />, text: <>Bấm nút <b>Chia sẻ</b> ở thanh dưới cùng (ô vuông có mũi tên đi lên).</> },
    { icon: <IPlus size={20} />, text: <>Kéo xuống, chọn <b>“Thêm vào MH chính”</b> (Add to Home Screen), rồi bấm <b>Thêm</b>.</> },
    { icon: <LogoMark size={24} />, text: <>Mở <b>Mộc</b> từ màn hình chính và bấm <b>“Bật thông báo”</b> — iPhone chỉ cho nhận thông báo khi mở theo cách này (iOS 16.4 trở lên).</> },
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Thêm Mộc vào màn hình chính">
      {installed ? (
        <p className="py-6 text-center text-muted">Bạn đang dùng Mộc từ màn hình chính rồi 🎉</p>
      ) : (
        <>
          {!ios && deferred && (
            <button className="btn-primary mb-4 h-12 w-full" onClick={async () => { await deferred?.prompt(); deferred = null; onClose(); }}>
              Cài đặt app Mộc
            </button>
          )}
          <p className="text-sm text-muted">{ios ? "Trên iPhone / iPad:" : "Trên iPhone (Safari) làm như sau. Với Android, mở menu ⋮ của Chrome → “Thêm vào màn hình chính”."}</p>
          <ol className="mt-3 space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-2xl bg-cream p-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-paper text-bean">{s.icon}</span>
                <span className="text-sm leading-relaxed"><b className="text-caramel">Bước {i + 1}.</b> {s.text}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Sheet>
  );
}
