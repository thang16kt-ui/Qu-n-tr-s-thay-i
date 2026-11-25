"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/session";
import { useMyOrders } from "@/lib/my-orders";
import { currentSubscription } from "@/lib/push";
import { api, asset, type VoucherOption } from "@/lib/api";
import { unlockAudio } from "@/lib/sound";
import { describeSelection } from "@/lib/pricing";
import { pointsFor } from "@/lib/tiers";
import { dateShort, vnd } from "@/lib/format";
import type { MenuItem } from "@/lib/types";
import Sheet from "./Sheet";
import { IChevron, IGift, IMinus, IPlus, ICheck } from "./Icons";
import { useToast } from "./Toast";

export default function CartSheet({ open, onClose, menu }: { open: boolean; onClose: () => void; menu: MenuItem[] }) {
  const cart = useCart();
  const { phone } = useSession();
  const { refresh } = useMyOrders();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [vouchers, setVouchers] = useState<VoucherOption[]>([]);
  const [voucherId, setVoucherId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const soldOut = cart.lines.filter((l) => menu.find((m) => m.id === l.itemId)?.available === false);
  const items = useMemo(
    () => cart.lines.map(({ itemId, qty, size, sugar, ice, toppings, note }) => ({ itemId, qty, size, sugar, ice, toppings, note })),
    [cart.lines],
  );

  // Hỏi Supabase: mỗi voucher giảm được bao nhiêu cho giỏ hàng hiện tại
  useEffect(() => {
    if (!open || !phone || items.length === 0) return;
    let alive = true;
    api.previewVouchers(phone, items).then((list) => {
      if (!alive) return;
      setVouchers(list);
      setVoucherId((cur) => (cur && list.some((v) => v.id === cur && v.discount > 0) ? cur : null));
    }).catch(() => {});
    return () => { alive = false; };
  }, [open, phone, items]);

  const usable = vouchers.filter((v) => v.discount > 0);
  const chosen = vouchers.find((v) => v.id === voucherId && v.discount > 0) ?? null;
  const discount = chosen?.discount ?? 0;
  const total = Math.max(0, cart.total - discount);

  async function placeOrder() {
    unlockAudio();
    setBusy(true);
    setError("");
    try {
      const order = await api.placeOrder(phone!, items, await currentSubscription().catch(() => null), chosen?.id ?? null);
      cart.clear();
      setVoucherId(null);
      await refresh();
      onClose();
      toast(`Đã đặt đơn #${order.code}`);
      router.push("/orders/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Giỏ hàng"
      footer={cart.lines.length > 0 && (
        <div>
          {error && <p className="mb-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          {discount > 0 && (
            <div className="mb-1 space-y-0.5 text-sm">
              <div className="flex justify-between text-muted"><span>Tạm tính</span><span>{vnd(cart.total)}</span></div>
              <div className="flex justify-between text-caramel"><span>Ưu đãi</span><span>−{vnd(discount)}</span></div>
            </div>
          )}
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-muted">Tổng cộng</span>
            <span className="text-2xl font-bold text-bean-dark">{vnd(total)}</span>
          </div>
          <button onClick={placeOrder} disabled={busy || soldOut.length > 0} className="btn-primary h-14 w-full text-base">
            {busy ? "Đang gửi đơn…" : "Đặt món"}
          </button>
          <p className="mt-2 text-center text-xs text-muted">Thanh toán tại quầy · Tích {pointsFor(total)} điểm khi nhân viên quét mã</p>
        </div>
      )}>
      {cart.lines.length === 0 ? (
        <div className="py-10 text-center text-muted">Giỏ hàng đang trống.</div>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {cart.lines.map((l, i) => {
              const out = soldOut.includes(l);
              return (
                <li key={i} className={`flex gap-3 py-4 ${out ? "opacity-60" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset(l.image)} alt="" className={`h-16 w-16 rounded-2xl bg-cream-2 ${out ? "grayscale" : ""}`} />
                  <div className="flex-1">
                    <div className="font-semibold text-bean-dark">{l.name}</div>
                    <div className="text-xs text-muted">{describeSelection(l)}</div>
                    {l.note && <div className="text-xs italic text-muted">“{l.note}”</div>}
                    {out && <div className="mt-1 text-xs font-semibold text-danger">Món này vừa hết — vui lòng bỏ ra</div>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-semibold text-bean">{vnd(l.lineTotal)}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => cart.setQty(i, l.qty - 1)} className="grid h-8 w-8 place-items-center rounded-full bg-cream-2 text-bean" aria-label="Bớt"><IMinus size={16} /></button>
                        <span className="w-5 text-center font-bold">{l.qty}</span>
                        <button onClick={() => cart.setQty(i, l.qty + 1)} disabled={out} className="grid h-8 w-8 place-items-center rounded-full bg-cream-2 text-bean" aria-label="Thêm"><IPlus size={16} /></button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ---------- Chọn ưu đãi ---------- */}
          <div className="mt-1 rounded-2xl border border-line bg-cream/60">
            <button onClick={() => setPicking(!picking)} className="flex w-full items-center gap-3 p-3.5 text-left">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-caramel/15 text-caramel"><IGift size={20} /></span>
              <span className="min-w-0 flex-1">
                {chosen ? (
                  <>
                    <span className="block truncate font-semibold text-bean-dark">{chosen.title}</span>
                    <span className="block text-sm font-semibold text-caramel">−{vnd(chosen.discount)}</span>
                  </>
                ) : (
                  <>
                    <span className="block font-semibold text-bean-dark">Chọn ưu đãi</span>
                    <span className="block text-sm text-muted">
                      {usable.length ? `${usable.length} ưu đãi dùng được cho đơn này` : vouchers.length ? "Chưa có ưu đãi phù hợp với giỏ hàng" : "Bạn chưa có ưu đãi nào"}
                    </span>
                  </>
                )}
              </span>
              <IChevron size={18} className={`shrink-0 text-muted transition ${picking ? "rotate-90" : ""}`} />
            </button>

            {picking && (
              <ul className="space-y-2 border-t border-line p-2.5">
                {vouchers.map((v) => {
                  const ok = v.discount > 0;
                  const on = v.id === voucherId && ok;
                  return (
                    <li key={v.id}>
                      <button disabled={!ok} onClick={() => { setVoucherId(on ? null : v.id); setPicking(false); }}
                        className={`flex w-full items-center gap-3 rounded-xl border-2 bg-paper p-3 text-left transition ${on ? "border-caramel" : "border-transparent"} ${ok ? "" : "opacity-55"}`}>
                        <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: v.color || "#C47A4A" }} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-bean-dark">{v.title}</span>
                          <span className="block text-xs text-muted">{ok ? `Giảm ${vnd(v.discount)} · HSD ${dateShort(v.expires_at)}` : v.reason}</span>
                        </span>
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${on ? "border-caramel bg-caramel text-white" : "border-line"}`}>
                          {on && <ICheck size={14} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {vouchers.length === 0 && <li className="p-3 text-center text-sm text-muted">Đổi điểm lấy ưu đãi ở tab Ưu đãi nhé.</li>}
                {chosen && (
                  <li>
                    <button onClick={() => { setVoucherId(null); setPicking(false); }} className="w-full py-2 text-sm font-semibold text-muted">Không dùng ưu đãi</button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
