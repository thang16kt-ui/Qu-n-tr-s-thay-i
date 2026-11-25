"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/session";
import { useMyOrders } from "@/lib/my-orders";
import { currentSubscription } from "@/lib/push";
import { api, asset } from "@/lib/api";
import { unlockAudio } from "@/lib/sound";
import { describeSelection } from "@/lib/pricing";
import { pointsFor } from "@/lib/tiers";
import { vnd } from "@/lib/format";
import type { MenuItem } from "@/lib/types";
import Sheet from "./Sheet";
import { IMinus, IPlus } from "./Icons";
import { useToast } from "./Toast";

export default function CartSheet({ open, onClose, menu }: { open: boolean; onClose: () => void; menu: MenuItem[] }) {
  const cart = useCart();
  const { phone } = useSession();
  const { refresh } = useMyOrders();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const soldOut = cart.lines.filter((l) => menu.find((m) => m.id === l.itemId)?.available === false);

  async function placeOrder() {
    unlockAudio();
    setBusy(true);
    setError("");
    try {
      const order = await api.placeOrder(
        phone!,
        cart.lines.map(({ itemId, qty, size, sugar, ice, toppings, note }) => ({ itemId, qty, size, sugar, ice, toppings, note })),
        await currentSubscription().catch(() => null),
      );
      cart.clear();
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
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-muted">Tổng cộng</span>
            <span className="text-2xl font-bold text-bean-dark">{vnd(cart.total)}</span>
          </div>
          <button onClick={placeOrder} disabled={busy || soldOut.length > 0} className="btn-primary h-14 w-full text-base">
            {busy ? "Đang gửi đơn…" : "Đặt món"}
          </button>
          <p className="mt-2 text-center text-xs text-muted">Thanh toán tại quầy · Tích {pointsFor(cart.total)} điểm khi nhân viên quét mã</p>
        </div>
      )}>
      {cart.lines.length === 0 ? (
        <div className="py-10 text-center text-muted">Giỏ hàng đang trống.</div>
      ) : (
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
      )}
    </Sheet>
  );
}
