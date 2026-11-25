"use client";
import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useMyVouchers } from "@/lib/vouchers";
import type { Voucher } from "@/lib/types";
import VoucherCard from "@/components/VoucherCard";
import { useToast } from "@/components/Toast";

export default function OffersPage() {
  const { phone, member } = useSession();
  const { list: mine, reload } = useMyVouchers(phone);
  const [tab, setTab] = useState<"mine" | "redeem">("mine");
  const [catalog, setCatalog] = useState<Voucher[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    sb().from("vouchers").select("*").eq("active", true).gt("cost_points", 0).order("cost_points")
      .then(({ data }) => setCatalog((data ?? []) as Voucher[]));
  }, []);

  async function redeem(v: Voucher) {
    if (!confirm(`Dùng ${v.cost_points} điểm để đổi “${v.title}”?`)) return;
    setBusy(v.id);
    const res = await fetch("/api/vouchers/redeem", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, voucherId: v.id }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return toast(data.error || "Không đổi được");
    toast("Đổi ưu đãi thành công 🎉");
    await reload();
    setTab("mine");
  }

  const points = member?.points ?? 0;

  return (
    <div className="px-5 pt-safe">
      <h1 className="pt-5 text-2xl font-bold text-bean-dark">Ưu đãi</h1>
      <div className="mt-1 text-sm text-muted">Bạn đang có <b className="text-caramel">{points} điểm</b></div>

      <div className="mt-4 grid grid-cols-2 rounded-full bg-cream-2 p-1">
        {([["mine", `Voucher của tôi (${mine.length})`], ["redeem", "Đổi ưu đãi"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full py-2.5 text-sm font-semibold transition ${tab === k ? "bg-paper text-bean-dark shadow-sm" : "text-muted"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {tab === "mine" && (
          <>
            {mine.map((mv) => mv.vouchers && <VoucherCard key={mv.id} v={mv.vouchers} code={mv.code} expires={mv.expires_at} />)}
            {mine.length === 0 && <p className="py-10 text-center text-muted">Chưa có voucher. Chuyển sang “Đổi ưu đãi” nhé!</p>}
            {mine.length > 0 && <p className="pt-2 text-center text-xs text-muted">Đọc mã voucher cho nhân viên khi thanh toán tại quầy.</p>}
          </>
        )}
        {tab === "redeem" && catalog.map((v) => {
          const enough = points >= v.cost_points;
          return (
            <VoucherCard key={v.id} v={v} action={
              <button disabled={!enough || busy === v.id} onClick={() => redeem(v)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold ${enough ? "bg-bean text-cream" : "bg-line text-muted"}`}>
                {busy === v.id ? "Đang đổi…" : enough ? "Đổi ngay" : `Cần thêm ${v.cost_points - points} điểm`}
              </button>
            } />
          );
        })}
      </div>
    </div>
  );
}
