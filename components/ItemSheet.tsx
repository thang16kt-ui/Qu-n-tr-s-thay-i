"use client";
import { useEffect, useState } from "react";
import type { MenuItem, Selection } from "@/lib/types";
import { sanitizeSelection, unitPrice } from "@/lib/pricing";
import { vnd } from "@/lib/format";
import { asset } from "@/lib/api";
import { useCart } from "@/lib/cart";
import Sheet from "./Sheet";
import { IMinus, IPlus, ICheck } from "./Icons";
import { useToast } from "./Toast";

function Chips({ label, options, value, onChange, extra }: {
  label: string; options: string[]; value?: string; onChange: (v: string) => void; extra?: (o: string) => string | null;
}) {
  return (
    <div className="mt-5">
      <div className="text-sm font-semibold text-bean-dark">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o;
          const ex = extra?.(o);
          return (
            <button key={o} onClick={() => onChange(o)}
              className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition ${on ? "border-bean bg-bean text-cream" : "border-line bg-paper text-bean-dark"}`}>
              {o}{ex && <span className={on ? "text-cream/75" : "text-muted"}> {ex}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ItemSheet({ item, onClose }: { item: MenuItem | null; onClose: () => void }) {
  const cart = useCart();
  const toast = useToast();
  const [sel, setSel] = useState<Selection>({ toppings: [] });
  const [qty, setQty] = useState(1);

  const itemId = item?.id;
  useEffect(() => {
    if (item) { setSel(sanitizeSelection(item, {})); setQty(1); }
    // chỉ reset khi đổi sang món khác (không reset khi menu cập nhật realtime)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  if (!item) return null;
  const o = item.options || {};
  const price = unitPrice(item, sel);

  function add() {
    if (!item) return;
    const s = sanitizeSelection(item, sel);
    cart.add({ itemId: item.id, name: item.name, image: item.image, qty, unitPrice: unitPrice(item, s), ...s });
    toast(`Đã thêm ${qty} ${item.name}`);
    onClose();
  }

  return (
    <Sheet open={!!item} onClose={onClose} title={item.name}
      footer={
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full bg-cream-2 p-1">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-10 w-10 place-items-center rounded-full bg-paper text-bean" aria-label="Bớt"><IMinus size={18} /></button>
            <span className="w-9 text-center text-lg font-bold">{qty}</span>
            <button onClick={() => setQty(Math.min(20, qty + 1))} className="grid h-10 w-10 place-items-center rounded-full bg-paper text-bean" aria-label="Thêm"><IPlus size={18} /></button>
          </div>
          <button onClick={add} disabled={!item.available} className="btn-primary h-12 flex-1">
            {item.available ? `Thêm · ${vnd(price * qty)}` : "Món đã hết"}
          </button>
        </div>
      }>
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(item.image)} alt="" className="h-28 w-28 rounded-3xl bg-cream-2 object-cover" />
        <div className="flex-1">
          <p className="text-sm leading-relaxed text-muted">{item.description}</p>
          <p className="mt-2 text-lg font-bold text-bean">{vnd(item.price)}</p>
        </div>
      </div>

      {o.sizes && o.sizes.length > 0 && (
        <Chips label="Kích cỡ" options={o.sizes.map((s) => s.name)} value={sel.size}
          onChange={(v) => setSel({ ...sel, size: v })}
          extra={(n) => { const p = o.sizes!.find((s) => s.name === n)!.price; return p ? `+${vnd(p)}` : null; }} />
      )}
      {o.sugar && o.sugar.length > 0 && (
        <Chips label="Đường" options={o.sugar} value={sel.sugar} onChange={(v) => setSel({ ...sel, sugar: v })} />
      )}
      {o.ice && o.ice.length > 0 && (
        <Chips label="Đá" options={o.ice} value={sel.ice} onChange={(v) => setSel({ ...sel, ice: v })} />
      )}
      {o.toppings && o.toppings.length > 0 && (
        <div className="mt-5">
          <div className="text-sm font-semibold text-bean-dark">Topping <span className="font-normal text-muted">(chọn nhiều)</span></div>
          <div className="mt-2 divide-y divide-line rounded-2xl border border-line">
            {o.toppings.map((t) => {
              const on = sel.toppings.includes(t.name);
              return (
                <button key={t.name} className="flex w-full items-center justify-between px-4 py-3 text-left"
                  onClick={() => setSel({ ...sel, toppings: on ? sel.toppings.filter((x) => x !== t.name) : [...sel.toppings, t.name] })}>
                  <span className="flex items-center gap-3">
                    <span className={`grid h-6 w-6 place-items-center rounded-lg border-2 ${on ? "border-bean bg-bean text-cream" : "border-line"}`}>{on && <ICheck size={16} />}</span>
                    <span className="text-sm font-medium">{t.name}</span>
                  </span>
                  <span className="text-sm text-muted">{t.price ? `+${vnd(t.price)}` : "Miễn phí"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-5">
        <div className="text-sm font-semibold text-bean-dark">Ghi chú</div>
        <textarea value={sel.note || ""} onChange={(e) => setSel({ ...sel, note: e.target.value.slice(0, 120) })}
          rows={2} placeholder="Ví dụ: ít ngọt hơn, để riêng đá…"
          className="mt-2 w-full resize-none rounded-2xl border-2 border-line bg-paper px-4 py-3 text-sm outline-none focus:border-caramel" />
      </div>
    </Sheet>
  );
}
