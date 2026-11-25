"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMyOrders } from "@/lib/my-orders";
import { PROMOS } from "@/lib/promos";
import { pointsFor } from "@/lib/tiers";
import { timeAgo } from "@/lib/format";
import { viewStatus, orderNo, ORDER_EXPIRE_MIN } from "@/lib/orders";
import { IBell } from "./Icons";
import Sheet from "./Sheet";

type Noti = { id: string; at: string; title: string; body: string; href: string; tone: "done" | "info" | "warn" | "promo" };
const KEY = "moc.notiSeen";

export default function NotificationBell() {
  const { orders } = useMyOrders();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string>("1970-01-01");
  useEffect(() => { setSeen(localStorage.getItem(KEY) || "1970-01-01"); }, []);

  const list = useMemo<Noti[]>(() => {
    const out: Noti[] = [];
    for (const o of orders.slice(0, 10)) {
      if (o.done_at) out.push({ id: o.id + "d", at: o.done_at, title: `Đơn ${orderNo(o)} đã xong`, body: "Mời bạn ra quầy nhận món nhé ☕", href: `/orders/?id=${o.id}`, tone: "done" });
      if (o.confirmed_at) out.push({ id: o.id + "c", at: o.confirmed_at, title: `Đã vào hàng chờ · số ${orderNo(o)}`, body: `+${pointsFor(o.total)} điểm đã được cộng vào tài khoản`, href: `/orders/?id=${o.id}`, tone: "info" });
      const vs = viewStatus(o);
      if (vs === "cancelled" || vs === "expired") {
        const at = vs === "expired" ? new Date(new Date(o.created_at).getTime() + ORDER_EXPIRE_MIN * 60000).toISOString() : o.created_at;
        out.push({ id: o.id + "x", at, title: `Đơn ${orderNo(o)} đã hết hạn`, body: "Bạn có thể đặt lại bất cứ lúc nào.", href: "/order", tone: "warn" });
      }
    }
    for (const p of PROMOS) out.push({ id: p.id, at: p.date, title: p.title, body: p.body, href: p.href, tone: "promo" });
    return out.filter((n) => n.at <= new Date().toISOString()).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
  }, [orders]);

  const unread = list.filter((n) => n.at > seen).length;

  function openSheet() {
    setOpen(true);
    const now = new Date().toISOString();
    localStorage.setItem(KEY, now);
    setTimeout(() => setSeen(now), 400);
  }

  const dot = { done: "bg-done", info: "bg-caramel", warn: "bg-danger", promo: "bg-latte" };

  return (
    <>
      <button onClick={openSheet} className="relative grid h-11 w-11 place-items-center rounded-full bg-paper text-bean shadow-sm" aria-label="Thông báo">
        <IBell size={22} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-caramel px-1 text-[0.65rem] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Thông báo">
        <ul className="divide-y divide-line">
          {list.map((n) => (
            <li key={n.id}>
              <Link href={n.href} onClick={() => setOpen(false)} className="flex gap-3 py-3.5">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot[n.tone]}`} />
                <span className="flex-1">
                  <span className="block font-semibold text-bean-dark">{n.title}</span>
                  <span className="block text-sm text-muted">{n.body}</span>
                  <span className="mt-0.5 block text-xs text-muted/80">{timeAgo(n.at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
