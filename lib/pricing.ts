import type { MenuItem, Selection } from "./types";

/** Giá 1 món theo lựa chọn — dùng chung ở trình duyệt và server (server tính lại, không tin giá từ client) */
export function unitPrice(item: MenuItem, sel: Selection): number {
  const o = item.options || {};
  let p = item.price;
  const size = o.sizes?.find((s) => s.name === sel.size);
  if (size) p += size.price;
  for (const t of sel.toppings || []) {
    const tp = o.toppings?.find((x) => x.name === t);
    if (tp) p += tp.price;
  }
  return p;
}

/** Chỉ giữ những lựa chọn có thật trong options của món */
export function sanitizeSelection(item: MenuItem, sel: Partial<Selection>): Selection {
  const o = item.options || {};
  const pick = (list: string[] | undefined, v?: string) => (list && list.length ? (v && list.includes(v) ? v : list[Math.min(2, list.length - 1)]) : undefined);
  return {
    size: o.sizes?.length ? (o.sizes.some((s) => s.name === sel.size) ? sel.size : o.sizes[0].name) : undefined,
    sugar: pick(o.sugar, sel.sugar),
    ice: pick(o.ice, sel.ice),
    toppings: (sel.toppings || []).filter((t) => o.toppings?.some((x) => x.name === t)),
    note: (sel.note || "").slice(0, 120) || undefined,
  };
}

export function describeSelection(sel: Selection): string {
  return [sel.size && `Size ${sel.size}`, sel.sugar, sel.ice, ...(sel.toppings || [])].filter(Boolean).join(" · ");
}
