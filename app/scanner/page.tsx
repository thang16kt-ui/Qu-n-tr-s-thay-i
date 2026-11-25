"use client";
import { useCallback, useState } from "react";
import StaffGate, { useStaff } from "@/components/staff/StaffGate";
import Scanner from "@/components/Scanner";
import { IQR } from "@/components/Icons";
import { normalizePhone } from "@/lib/format";
import { parseQR } from "@/lib/qr";
import { beep, buzz } from "@/lib/sound";

/**
 * Điện thoại làm máy quét cho máy POS trên máy tính.
 * Quét mã QR của khách bằng camera điện thoại → mã được gửi sang /pos (realtime) → máy tính tự mở đơn.
 */
export default function ScannerPage() {
  return (
    <StaffGate page="scanner" title="Máy quét">
      <PhoneScanner />
    </StaffGate>
  );
}

type Sent = { label: string; at: string; ok: boolean };

function describe(raw: string): { raw: string; label: string } | null {
  const text = raw.trim();
  if (/^moc/i.test(text)) {
    const q = parseQR(text);
    if (!q.ok) return null;
    return { raw: text, label: q.orderCode ? `Đơn ${q.orderCode} · •••• ${q.phone.slice(-4)}` : `Thành viên •••• ${q.phone.slice(-4)}` };
  }
  const phone = normalizePhone(text);
  return phone ? { raw: phone, label: `SĐT •••• ${phone.slice(-4)}` } : null;
}

function PhoneScanner() {
  const { api } = useStaff();
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Sent | null>(null);
  const [history, setHistory] = useState<Sent[]>([]);
  const [manual, setManual] = useState("");

  const send = useCallback(async (raw: string) => {
    const d = describe(raw);
    const at = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (!d) {
      buzz();
      setLast({ label: "Không đọc được mã", at, ok: false });
      return;
    }
    setBusy(true);
    try {
      await api.pushScan(d.raw);
      beep();
      const s = { label: d.label, at, ok: true };
      setLast(s);
      setHistory((h) => [s, ...h].slice(0, 6));
    } catch (e) {
      buzz();
      setLast({ label: (e as Error).message, at, ok: false });
    }
    setBusy(false);
  }, [api]);

  const onCamera = useCallback((text: string) => { setCamera(false); send(text); }, [send]);

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <p className="text-center text-sm text-muted">
        Mở <b className="text-bean-dark">Quầy</b> trên máy tính. Mã quét ở đây sẽ tự mở trên máy tính.
      </p>

      {last && (
        <div className={`animate-pop rounded-3xl p-5 text-center text-white ${last.ok ? "bg-done" : "bg-caramel"}`}>
          <div className="text-2xl font-bold">{last.ok ? "✓ Đã gửi lên máy POS" : "✕ Chưa gửi được"}</div>
          <div className="mt-1 text-lg font-semibold">{last.label}</div>
          <div className="text-sm text-white/80">{last.at}</div>
        </div>
      )}

      <button disabled={busy} onClick={() => setCamera(true)}
        className="btn-primary flex h-40 w-full flex-col items-center justify-center gap-2 text-2xl active:scale-[0.98] disabled:opacity-60">
        <IQR size={48} />
        {last ? "Quét mã tiếp theo" : "Bắt đầu quét"}
      </button>

      <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { send(manual); setManual(""); } }}
        className="flex h-14 items-center rounded-2xl border-2 border-line bg-paper pl-4">
        <input value={manual} onChange={(e) => setManual(e.target.value)} inputMode="numeric" placeholder="Hoặc nhập SĐT khách"
          className="min-w-0 flex-1 bg-transparent text-base outline-none" />
        <button className="mr-1.5 h-11 rounded-xl bg-cream-2 px-4 font-bold text-bean">Gửi</button>
      </form>

      {history.length > 0 && (
        <div className="card p-4">
          <div className="text-sm font-bold text-bean-dark">Vừa gửi</div>
          <ul className="mt-2 divide-y divide-line text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex justify-between py-2"><span>{h.label}</span><span className="text-muted">{h.at}</span></li>
            ))}
          </ul>
        </div>
      )}

      {camera && <Scanner onResult={onCamera} onClose={() => setCamera(false)} title="Quét mã QR trên app của khách" />}
    </div>
  );
}
