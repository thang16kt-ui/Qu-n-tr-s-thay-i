"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMyOrders } from "@/lib/my-orders";
import { ACTIVE, STATUS_LABEL, orderNo, viewStatus } from "@/lib/orders";
import { dateTime, vnd } from "@/lib/format";
import { asset } from "@/lib/api";
import type { Order } from "@/lib/types";
import OrderDetail from "@/components/OrderDetail";
import { IChevron, IQR } from "@/components/Icons";

function pill(o: Order) {
  const vs = viewStatus(o);
  const cls = vs === "done" ? "bg-done/15 text-done" : vs === "expired" || vs === "cancelled" ? "bg-danger-soft text-danger" : "bg-accent-soft text-caramel";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{STATUS_LABEL[vs]}</span>;
}

function ActiveCard({ o }: { o: Order }) {
  return (
    <Link href={`/orders/?id=${o.id}`} className="relative block overflow-hidden rounded-3xl bg-gradient-to-br from-[#e0623f] to-caramel p-5 text-white shadow-[0_22px_44px_-24px_rgba(150,40,20,0.65)]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#ffe3d6]">{o.code ? "Số thứ tự của bạn" : "Đơn chờ đến quầy"}</div>
          <div className="mt-1 text-5xl font-bold leading-none tracking-tight">{o.code ? `#${o.code}` : o.ref}</div>
        </div>
        <span className="rounded-full bg-mustard px-3 py-1 text-xs font-bold text-mustard-ink">{STATUS_LABEL[viewStatus(o)]}</span>
      </div>
      <div className="mt-3 line-clamp-1 text-sm text-white/85">{o.items.map((l) => `${l.qty}× ${l.name}`).join(", ")}</div>
      <div className="mt-4 flex items-center justify-between">
        <span className="font-semibold">{vnd(o.total)}</span>
        <span className="flex items-center gap-1.5 rounded-full bg-paper px-4 py-2 text-sm font-semibold text-bean-dark">
          <IQR size={18} /> {o.code ? "Xem tiến độ" : "Mở mã QR"}
        </span>
      </div>
    </Link>
  );
}

function OrderRow({ o }: { o: Order }) {
  return (
    <Link href={`/orders/?id=${o.id}`} className="flex items-center gap-3 py-3.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset(o.items[0]?.image)} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-cream-2" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-bold text-bean-dark">{orderNo(o)}</span>
          <span className="text-xs text-muted">{dateTime(o.created_at)}</span>
        </span>
        <span className="block truncate text-sm text-muted">{o.items.map((l) => `${l.qty}× ${l.name}`).join(", ")}</span>
      </span>
      <span className="flex flex-col items-end gap-1">
        {pill(o)}
        <span className="text-sm font-semibold text-bean">{vnd(o.total)}</span>
      </span>
      <IChevron size={18} className="text-muted" />
    </Link>
  );
}

function OrdersInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const { orders, loaded } = useMyOrders();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);

  if (id) {
    const o = orders.find((x) => x.id === id);
    if (o) return <OrderDetail order={o} />;
    return <p className="px-5 pt-24 text-center text-muted">{loaded ? "Không tìm thấy đơn này." : "Đang tải đơn…"}</p>;
  }

  const active = orders.filter((o) => ACTIVE.includes(viewStatus(o) as Order["status"]));
  const past = orders.filter((o) => !active.includes(o));

  return (
    <div className="px-5 pt-safe">
      <h1 className="pt-5 text-2xl font-bold text-bean-dark">Đơn hàng</h1>
      <p className="text-sm text-muted">Mang mã QR đến quầy — đơn vào hàng chờ theo thứ tự quét.</p>

      <div className="mt-4 space-y-3">
        {active.map((o) => <ActiveCard key={o.id} o={o} />)}
      </div>

      {loaded && orders.length === 0 && (
        <div className="card mt-4 p-8 text-center">
          <p className="text-muted">Bạn chưa có đơn nào.</p>
          <Link href="/order/" className="btn-primary mt-4 inline-block px-6 py-3 text-sm">Đặt món ngay</Link>
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wider text-muted">Đơn trước đây</h2>
          <div className="card mt-2 divide-y divide-line px-4">
            {past.map((o) => <OrderRow key={o.id} o={o} />)}
          </div>
        </>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return <Suspense fallback={null}><OrdersInner /></Suspense>;
}
