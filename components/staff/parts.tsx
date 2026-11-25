"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { asset } from "@/lib/api";
import { vnd } from "@/lib/format";
import { sanitizeSelection, unitPrice } from "@/lib/pricing";
import { tierInfo } from "@/lib/tiers";
import type { Member, MenuItem, Order, OrderLine, Selection } from "@/lib/types";
import { ICheck, IClose, IMinus, IPlus } from "@/components/Icons";

/** Hộp thoại giữa màn hình (dùng trên tablet) */
export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <div className="animate-fade absolute inset-0 bg-bean-dark/40" onClick={onClose} />
      <div className={`animate-pop relative flex max-h-[90dvh] w-full flex-col rounded-3xl bg-paper shadow-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <div className="text-xl font-bold text-bean-dark">{title}</div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-cream-2 text-bean" aria-label="Đóng"><IClose size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/** Thẻ thành viên rút gọn: chỉ hiện 4 số cuối SĐT */
export function MemberBadge({ member, big }: { member: Member; big?: boolean }) {
  const t = tierInfo(member.tier);
  return (
    <div className="flex items-center gap-4 rounded-3xl p-4 text-white" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}>
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl font-bold">
        {(member.name || "K").trim().charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-bold">{member.name || "Thành viên"}</div>
        <div className="text-sm text-white/85">SĐT •••• {member.phone.slice(-4)} · Hạng {t.name}</div>
      </div>
      <div className="text-right">
        <div className={`${big ? "text-4xl" : "text-3xl"} font-bold tabular-nums leading-none`}>{member.points}</div>
        <div className="text-xs font-semibold uppercase tracking-wider text-white/80">điểm</div>
      </div>
    </div>
  );
}

/** Tuỳ chọn cho nhân viên đọc: "Size L · Đường vừa · Đá ít · Kem muối" (tránh "Vừa · Vừa") */
export function staffOptions(l: Pick<OrderLine, "size" | "sugar" | "ice" | "toppings">, withSize = true): string {
  const low = (v: string) => v.charAt(0).toLowerCase() + v.slice(1);
  const sugar = l.sugar && (/đường/i.test(l.sugar) ? l.sugar : `Đường ${low(l.sugar)}`);
  const ice = l.ice && (/đá/i.test(l.ice) ? l.ice : `Đá ${low(l.ice)}`);
  return [withSize && l.size && `Size ${l.size}`, sugar, ice, ...(l.toppings || [])].filter(Boolean).join(" · ");
}

export function LineText({ line, large }: { line: OrderLine; large?: boolean }) {
  const opts = staffOptions(line);
  return (
    <div>
      <div className={large ? "text-xl font-bold leading-snug" : "font-semibold"}>
        <span className="text-caramel">{line.qty}×</span> {line.name}
      </div>
      {opts && <div className={large ? "text-base text-bean" : "text-sm text-muted"}>{opts}</div>}
      {line.note && <div className={`mt-0.5 inline-block rounded-lg bg-mustard/30 px-2 font-semibold text-mustard-ink ${large ? "text-base" : "text-sm"}`}>“{line.note}”</div>}
    </div>
  );
}

/** Tem dán ly 50×30mm — 1 tem / 1 ly (không in cho món bánh nếu đơn có đồ uống) */
export function CupLabels({ order, menu }: { order: Order | null; menu: MenuItem[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !order) return null;
  const cat = new Map(menu.map((m) => [m.id, m.category]));
  let lines = order.items.filter((l) => cat.get(l.itemId) !== "Bánh");
  if (!lines.length) lines = order.items;
  const cups = lines.flatMap((l) => Array.from({ length: l.qty }, () => l));
  const time = new Date(order.confirmed_at ?? Date.now()).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return createPortal(
    <div className="label-root">
      <style>{"@media print { @page { size: 50mm 30mm; margin: 0; } html, body { background: #fff !important; } }"}</style>
      {cups.map((l, i) => (
        <div key={i} className="cup-label">
          <div className="cup-head"><b>#{order.code ?? order.ref}</b><span>{i + 1}/{cups.length}</span></div>
          <div className="cup-name">{l.name}{l.size ? ` · ${l.size}` : ""}</div>
          <div className="cup-opt">{staffOptions(l, false)}</div>
          {l.note && <div className="cup-note">“{l.note}”</div>}
          <div className="cup-foot"><span>Mộc Coffee</span><span>{time}</span></div>
        </div>
      ))}
    </div>,
    document.body,
  );
}

function Chips({ label, options, value, onChange, extra }: {
  label: string; options: string[]; value?: string; onChange: (v: string) => void; extra?: (o: string) => string | null;
}) {
  return (
    <div className="mt-4">
      <div className="text-sm font-semibold text-bean-dark">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o;
          const ex = extra?.(o);
          return (
            <button key={o} onClick={() => onChange(o)}
              className={`min-h-12 rounded-2xl border-2 px-4 text-base font-semibold ${on ? "border-bean bg-bean text-cream" : "border-line bg-paper text-bean-dark"}`}>
              {o}{ex && <span className={on ? "text-cream/75" : "text-muted"}> {ex}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Chọn size / đường / đá / topping cho 1 món khi tạo đơn tại quầy */
export function OptionPicker({ item, onClose, onAdd }: {
  item: MenuItem | null; onClose: () => void; onAdd: (line: Omit<OrderLine, "lineTotal">) => void;
}) {
  const [sel, setSel] = useState<Selection>({ toppings: [] });
  const [qty, setQty] = useState(1);
  const id = item?.id;
  useEffect(() => {
    if (item) { setSel(sanitizeSelection(item, {})); setQty(1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!item) return null;
  const o = item.options || {};
  const price = unitPrice(item, sel);
  const add = () => {
    const s = sanitizeSelection(item, sel);
    onAdd({ itemId: item.id, name: item.name, image: item.image, qty, unitPrice: unitPrice(item, s), ...s });
  };
  return (
    <Modal open onClose={onClose} title={item.name}
      footer={
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full bg-cream-2 p-1">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-12 w-12 place-items-center rounded-full bg-paper text-bean"><IMinus /></button>
            <span className="w-10 text-center text-xl font-bold">{qty}</span>
            <button onClick={() => setQty(Math.min(20, qty + 1))} className="grid h-12 w-12 place-items-center rounded-full bg-paper text-bean"><IPlus /></button>
          </div>
          <button onClick={add} className="btn-primary h-14 flex-1 text-lg">Thêm · {vnd(price * qty)}</button>
        </div>
      }>
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(item.image)} alt="" className="h-20 w-20 rounded-2xl bg-cream-2 object-cover" />
        <div className="text-lg font-bold text-bean">{vnd(item.price)}</div>
      </div>
      {!!o.sizes?.length && (
        <Chips label="Kích cỡ" options={o.sizes.map((s) => s.name)} value={sel.size} onChange={(v) => setSel({ ...sel, size: v })}
          extra={(n) => { const p = o.sizes!.find((s) => s.name === n)!.price; return p ? `+${vnd(p)}` : null; }} />
      )}
      {!!o.sugar?.length && <Chips label="Đường" options={o.sugar} value={sel.sugar} onChange={(v) => setSel({ ...sel, sugar: v })} />}
      {!!o.ice?.length && <Chips label="Đá" options={o.ice} value={sel.ice} onChange={(v) => setSel({ ...sel, ice: v })} />}
      {!!o.toppings?.length && (
        <div className="mt-4">
          <div className="text-sm font-semibold text-bean-dark">Topping</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {o.toppings.map((t) => {
              const on = sel.toppings.includes(t.name);
              return (
                <button key={t.name}
                  onClick={() => setSel({ ...sel, toppings: on ? sel.toppings.filter((x) => x !== t.name) : [...sel.toppings, t.name] })}
                  className={`flex min-h-12 items-center gap-2 rounded-2xl border-2 px-4 font-semibold ${on ? "border-bean bg-bean text-cream" : "border-line bg-paper text-bean-dark"}`}>
                  {on && <ICheck size={18} />}{t.name} <span className={on ? "text-cream/75" : "text-muted"}>{t.price ? `+${vnd(t.price)}` : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-4">
        <div className="text-sm font-semibold text-bean-dark">Ghi chú</div>
        <input value={sel.note || ""} onChange={(e) => setSel({ ...sel, note: e.target.value.slice(0, 120) })}
          placeholder="Ví dụ: ít ngọt hơn, mang đi…"
          className="mt-2 h-12 w-full rounded-2xl border-2 border-line bg-paper px-4 outline-none focus:border-caramel" />
      </div>
    </Modal>
  );
}
