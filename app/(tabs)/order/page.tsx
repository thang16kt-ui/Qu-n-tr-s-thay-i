"use client";
import { useMemo, useState } from "react";
import { useMenu } from "@/lib/menu";
import { useCart } from "@/lib/cart";
import { CATEGORIES, type Category } from "@/lib/types";
import { vnd } from "@/lib/format";
import ItemSheet from "@/components/ItemSheet";
import CartSheet from "@/components/CartSheet";
import { IBag, IPlus, ISearch, IClose } from "@/components/Icons";

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export default function OrderPage() {
  const { items, loading } = useMenu();
  const cart = useCart();
  const [cat, setCat] = useState<Category>("Cà phê");
  const [q, setQ] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const shown = useMemo(() => {
    const query = strip(q.trim());
    if (query) return items.filter((i) => strip(i.name + " " + (i.description || "")).includes(query));
    return items.filter((i) => i.category === cat);
  }, [items, cat, q]);

  return (
    <div>
      <div className="sticky top-0 z-30 bg-cream/95 px-5 pb-3 pt-safe backdrop-blur">
        <h1 className="pt-5 text-2xl font-bold text-bean-dark">Đặt món</h1>
        <p className="text-sm text-muted">Đặt trước, đến quầy đưa mã QR là nhận.</p>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-paper px-4 shadow-sm">
          <ISearch className="text-muted" size={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm món: bạc xỉu, matcha…"
            className="h-12 flex-1 bg-transparent outline-none placeholder:text-muted/70" />
          {q && <button onClick={() => setQ("")} className="text-muted" aria-label="Xoá"><IClose size={18} /></button>}
        </div>
        {!q && (
          <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition ${cat === c ? "bg-bean text-cream" : "bg-paper text-bean-dark"}`}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 pt-1">
        {loading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-56 animate-pulse" />)}
        {!loading && shown.length === 0 && <p className="col-span-2 py-10 text-center text-muted">Không tìm thấy món phù hợp.</p>}
        {shown.map((it) => (
          <div key={it.id} className={`card relative flex flex-col overflow-hidden ${it.available ? "" : "opacity-55"}`}>
            <button disabled={!it.available} onClick={() => setPickedId(it.id)} className="text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.image || "/logo-mark.svg"} alt={it.name} className={`aspect-square w-full bg-cream-2 object-cover ${it.available ? "" : "grayscale"}`} />
              {!it.available && <span className="absolute left-3 top-3 rounded-full bg-bean-dark/80 px-2.5 py-1 text-xs font-semibold text-cream">Hết hàng</span>}
            </button>
            <div className="flex flex-1 flex-col p-3">
              <div className="text-[0.95rem] font-semibold leading-snug text-bean-dark">{it.name}</div>
              <div className="mt-auto flex items-center justify-between pt-2">
                <span className="font-bold text-bean">{vnd(it.price)}</span>
                <button disabled={!it.available} onClick={() => setPickedId(it.id)}
                  className={`flex items-center gap-0.5 rounded-full py-1.5 pl-2 pr-3 text-xs font-bold ${it.available ? "bg-bean text-cream active:scale-95" : "bg-line text-muted"}`}>
                  <IPlus size={14} /> Thêm
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
          <button onClick={() => setCartOpen(true)} className="animate-pop flex w-full max-w-md items-center gap-3 rounded-full bg-bean-dark py-2.5 pl-3 pr-5 text-cream shadow-xl">
            <span className="relative grid h-10 w-10 place-items-center rounded-full bg-cream/15">
              <IBag size={22} />
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-caramel px-1 text-[0.65rem] font-bold">{cart.count}</span>
            </span>
            <span className="flex-1 text-left font-semibold">Xem giỏ hàng</span>
            <span className="text-lg font-bold">{vnd(cart.total)}</span>
          </button>
        </div>
      )}

      <ItemSheet item={items.find((i) => i.id === pickedId) ?? null} onClose={() => setPickedId(null)} />
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} menu={items} />
    </div>
  );
}
