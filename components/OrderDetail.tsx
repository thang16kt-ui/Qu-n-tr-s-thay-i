"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { useCart } from "@/lib/cart";
import { buildQR } from "@/lib/qr";
import { ACTIVE, DONE_VISIBLE_MIN, ORDER_EXPIRE_MIN, STATUS_LABEL, viewStatus, type ViewStatus } from "@/lib/orders";
import { describeSelection } from "@/lib/pricing";
import { dateTime, vnd } from "@/lib/format";
import { currentSubscription } from "@/lib/push";
import { api, asset } from "@/lib/api";
import type { Order } from "@/lib/types";
import QRCode from "./QRCode";
import PushCard from "./PushCard";
import { IBack, ICheck } from "./Icons";

const STEPS: { key: ViewStatus[]; label: string }[] = [
  { key: ["pending", "confirmed"], label: "Chờ xác nhận" },
  { key: ["making"], label: "Đang pha" },
  { key: ["done"], label: "Đã xong" },
];

function Stepper({ status }: { status: ViewStatus }) {
  const idx = STEPS.findIndex((s) => s.key.includes(status));
  return (
    <div className="flex items-start">
      {STEPS.map((s, i) => {
        const done = i < idx || (i === idx && (status === "done" || status === "confirmed"));
        const cur = i === idx;
        return (
          <div key={s.label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div className={`h-1 flex-1 rounded ${i === 0 ? "opacity-0" : i <= idx ? "bg-caramel" : "bg-line"}`} />
              <div className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${done ? "bg-caramel text-white" : cur ? "border-[3px] border-caramel bg-paper text-caramel" : "bg-line text-muted"}`}>
                {done ? <ICheck size={16} /> : i + 1}
              </div>
              <div className={`h-1 flex-1 rounded ${i === STEPS.length - 1 ? "opacity-0" : i < idx ? "bg-caramel" : "bg-line"}`} />
            </div>
            <div className={`mt-1.5 text-center text-xs ${cur ? "font-bold text-bean-dark" : "text-muted"}`}>
              {s.label}
              {cur && status === "confirmed" && <span className="block font-normal text-caramel">Đã nhận đơn</span>}
              {cur && status === "making" && <span className="block animate-pulse font-normal text-caramel">đang làm…</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OrderItems({ order }: { order: Order }) {
  return (
    <div className="card px-4 py-1">
      <ul className="divide-y divide-line">
        {order.items.map((l, i) => (
          <li key={i} className="flex gap-3 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(l.image)} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-cream-2" />
            <span className="flex-1 text-sm">
              <span className="font-semibold text-bean-dark">{l.qty}× {l.name}</span>
              <span className="block text-xs text-muted">{describeSelection(l)}</span>
              {l.note && <span className="block text-xs italic text-muted">“{l.note}”</span>}
            </span>
            <span className="shrink-0 text-sm font-medium">{vnd(l.lineTotal)}</span>
          </li>
        ))}
        {!!order.discount && (
          <li className="space-y-1 py-3 text-sm">
            <div className="flex justify-between text-muted"><span>Tạm tính</span><span>{vnd(order.subtotal ?? order.total + order.discount)}</span></div>
            <div className="flex justify-between text-caramel"><span>Ưu đãi · {order.voucher_title}</span><span>−{vnd(order.discount)}</span></div>
          </li>
        )}
        <li className="flex justify-between py-3 font-bold text-bean-dark">
          <span>Tổng · thanh toán tại quầy</span><span>{vnd(order.total)}</span>
        </li>
      </ul>
    </div>
  );
}

export default function OrderDetail({ order }: { order: Order }) {
  const { phone } = useSession();
  const cart = useCart();
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  // đồng hồ để đơn tự "hết hạn" mà không cần tải lại
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const vs = viewStatus(order, now);
  const active = ACTIVE.includes(vs as Order["status"]);
  const freshDone = vs === "done" && !!order.done_at && now - new Date(order.done_at).getTime() < DONE_VISIBLE_MIN * 60_000;
  const expired = vs === "expired" || vs === "cancelled";

  // Đã bật thông báo từ trước → gắn vào đơn đang chờ để server gửi được
  useEffect(() => {
    if (!active || !phone) return;
    currentSubscription().then((sub) => sub && api.attachPush(phone, order.id, sub)).catch(() => {});
  }, [active, phone, order.id]);

  // Giữ màn hình sáng khi đang chờ đơn
  useEffect(() => {
    if (!active) return;
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof lock> } }).wakeLock
      ?.request("screen").then((l) => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, [active]);

  const back = () => router.push("/orders/");

  function reorder() {
    cart.replace(order.items);
    router.push("/order/");
  }

  // ---------- Đơn vừa xong: chỉ báo "Đã xong", không còn mã QR ----------
  if (freshDone) {
    return (
      <div className="-mb-28 flex min-h-dvh flex-col bg-done px-5 pb-32 pt-safe text-white">
        <button onClick={back} className="mt-4 grid h-10 w-10 place-items-center rounded-full bg-white/15" aria-label="Quay lại"><IBack /></button>
        <div className="animate-pop flex flex-1 flex-col items-center justify-center text-center">
          <div className="animate-ring grid h-24 w-24 place-items-center rounded-full bg-white text-done"><ICheck size={52} /></div>
          <div className="mt-6 text-lg font-semibold text-white/85">Đơn đã xong</div>
          <div className="text-7xl font-bold tracking-tight">#{order.code}</div>
          <p className="mt-3 text-lg">Mời bạn ra quầy nhận món ☕</p>
          <button onClick={back} className="mt-10 h-12 w-full max-w-xs rounded-full bg-white font-bold text-done">Tôi đã nhận món</button>
        </div>
      </div>
    );
  }

  const qrValue = phone ? buildQR(phone, order.code) : "";

  return (
    <div className="px-5 pt-safe">
      <header className="flex items-center gap-3 pt-4">
        <button onClick={back} className="grid h-10 w-10 place-items-center rounded-full bg-paper text-bean shadow-sm" aria-label="Quay lại"><IBack /></button>
        <div className="flex-1">
          <div className="text-lg font-bold text-bean-dark">Chi tiết đơn</div>
          <div className="text-xs text-muted">{dateTime(order.created_at)}</div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${expired ? "bg-danger-soft text-danger" : vs === "done" ? "bg-done/15 text-done" : "bg-accent-soft text-caramel"}`}>
          {STATUS_LABEL[vs]}
        </span>
      </header>

      {active && (
        <>
          <div className="mt-5 text-center">
            <div className="text-6xl font-bold leading-none tracking-tight text-bean-dark">#{order.code}</div>
          </div>
          <div className="mx-auto mt-5 w-fit rounded-[2rem] bg-white p-4 shadow-[0_20px_40px_-24px_rgba(42,22,14,0.35)]">
            {phone && <QRCode value={qrValue} size={224} />}
          </div>
          <p className="mx-auto mt-3 max-w-xs text-center text-sm font-medium text-bean">
            Đưa mã cho nhân viên để đặt món.
          </p>
          <div className="card mt-3 p-4"><Stepper status={vs} /></div>
        </>
      )}

      {!active && (
        <div className="mt-5 text-center text-5xl font-bold tracking-tight text-bean-dark">#{order.code}</div>
      )}

      {expired && (
        <div className="animate-pop mt-5 rounded-3xl border-2 border-danger/25 bg-danger-soft p-5 text-center">
          <div className="text-lg font-bold text-danger">Đơn đã hết hạn, vui lòng đặt lại</div>
          <p className="mt-1 text-sm text-danger/80">
            {vs === "cancelled" && (order.confirmed_at || new Date(order.created_at).getTime() > now - ORDER_EXPIRE_MIN * 60_000)
              ? "Đơn đã bị huỷ." : `Đơn chưa được quét trong ${ORDER_EXPIRE_MIN} phút.`}
          </p>
          <button onClick={reorder} className="btn-primary mt-4 h-11 w-full">Đặt lại các món này</button>
        </div>
      )}

      <h2 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Món đã đặt</h2>
      <OrderItems order={order} />

      {active && (
        <>
          <div className="mt-3"><PushCard onSubscribed={(s) => phone && api.attachPush(phone, order.id, s).catch(() => {})} /></div>
        </>
      )}

      {vs === "done" && (
        <button onClick={reorder} className="mt-4 h-12 w-full rounded-full border-2 border-line font-semibold text-bean-dark">Đặt lại các món này</button>
      )}
    </div>
  );
}
