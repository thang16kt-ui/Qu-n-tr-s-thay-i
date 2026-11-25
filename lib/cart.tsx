"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { OrderLine } from "./types";

type Cart = {
  lines: OrderLine[];
  count: number;
  total: number;
  add: (line: Omit<OrderLine, "lineTotal">) => void;
  setQty: (index: number, qty: number) => void;
  clear: () => void;
  replace: (lines: OrderLine[]) => void;
};

const Ctx = createContext<Cart | null>(null);
const KEY = "moc.cart";

const sameChoice = (a: OrderLine, b: Omit<OrderLine, "lineTotal">) =>
  a.itemId === b.itemId && a.size === b.size && a.sugar === b.sugar && a.ice === b.ice &&
  (a.note || "") === (b.note || "") && [...a.toppings].sort().join() === [...b.toppings].sort().join();

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try { setLines(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(lines));
  }, [lines, loaded]);

  const value = useMemo<Cart>(() => ({
    lines,
    count: lines.reduce((s, l) => s + l.qty, 0),
    total: lines.reduce((s, l) => s + l.lineTotal, 0),
    add: (line) => setLines((prev) => {
      const i = prev.findIndex((l) => sameChoice(l, line));
      if (i >= 0) {
        const next = [...prev];
        const qty = next[i].qty + line.qty;
        next[i] = { ...next[i], qty, lineTotal: qty * next[i].unitPrice };
        return next;
      }
      return [...prev, { ...line, lineTotal: line.qty * line.unitPrice }];
    }),
    setQty: (index, qty) => setLines((prev) =>
      qty <= 0 ? prev.filter((_, i) => i !== index)
        : prev.map((l, i) => (i === index ? { ...l, qty, lineTotal: qty * l.unitPrice } : l))),
    clear: () => setLines([]),
    replace: (ls) => setLines(ls),
  }), [lines]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart ngoài CartProvider");
  return c;
}
