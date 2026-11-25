"use client";
import { useSession } from "@/lib/session";
import { buildQR } from "@/lib/qr";
import Sheet from "./Sheet";
import QRCode from "./QRCode";

/** Mã thành viên (chỉ mang SĐT) — dùng khi mua tại quầy để tích điểm */
export default function MemberQRSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { phone, member } = useSession();
  if (!phone) return null;
  const value = buildQR(phone, null);
  return (
    <Sheet open={open} onClose={onClose} title="Mã thành viên">
      <div className="flex flex-col items-center pb-4">
        <div className="rounded-[2rem] bg-white p-4 shadow-[0_20px_40px_-24px_rgba(24,42,32,0.35)]">
          <QRCode value={value} size={232} />
        </div>
        <p className="mt-3 max-w-xs text-center text-sm text-bean">
          Đưa mã cho nhân viên quét để tích điểm khi mua tại quầy.
        </p>
        <div className="mt-4 rounded-full bg-accent-soft px-4 py-2 text-sm font-semibold text-bean-dark">
          Hạng {member?.tier ?? "Mầm"} · {member?.points ?? 0} điểm
        </div>
      </div>
    </Sheet>
  );
}
