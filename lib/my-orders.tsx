"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sb } from "./supabase";
import { useSession } from "./session";
import { chime } from "./sound";
import type { Order } from "./types";

const COLS = "id,code,member_phone,items,subtotal,discount,voucher_title,total,status,created_at,confirmed_at,done_at";

type Ctx = { orders: Order[]; loaded: boolean; refresh: () => Promise<void> };
const OrdersCtx = createContext<Ctx>({ orders: [], loaded: false, refresh: async () => {} });

/** Đơn của thành viên đang đăng nhập — cập nhật realtime */
export function MyOrdersProvider({ children }: { children: React.ReactNode }) {
  const { phone } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);
  const known = useRef<Map<string, string>>(new Map());

  const refresh = useCallback(async () => {
    if (!phone) return;
    const { data } = await sb().from("orders").select(COLS).eq("member_phone", phone)
      .order("created_at", { ascending: false }).limit(30);
    const list = (data ?? []) as Order[];
    list.forEach((o) => known.current.set(o.id, o.status));
    setOrders(list);
    setLoaded(true);
  }, [phone]);

  useEffect(() => {
    if (!phone) return;
    refresh();
    const ch = sb()
      .channel(`orders-${phone}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `member_phone=eq.${phone}` },
        (p) => {
          const o = p.new as Order;
          if (!o?.id) return;
          const before = known.current.get(o.id);
          known.current.set(o.id, o.status);
          setOrders((prev) => {
            const rest = prev.filter((x) => x.id !== o.id);
            return [{ ...(prev.find((x) => x.id === o.id) ?? {}), ...o } as Order, ...rest]
              .sort((a, b) => b.created_at.localeCompare(a.created_at));
          });
          // Đơn vừa chuyển sang "Đã xong": kêu + mở chi tiết đơn (màn hình chuyển xanh)
          if (o.status === "done" && before && before !== "done") {
            if (document.visibilityState === "visible") chime();
            router.push(`/orders/?id=${o.id}`);
          }
        })
      .subscribe();
    // Khi app mở lại từ nền, tải lại cho chắc
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => { sb().removeChannel(ch); document.removeEventListener("visibilitychange", onVis); };
  }, [phone, refresh, router]);

  return <OrdersCtx.Provider value={{ orders, loaded, refresh }}>{children}</OrdersCtx.Provider>;
}

export const useMyOrders = () => useContext(OrdersCtx);
