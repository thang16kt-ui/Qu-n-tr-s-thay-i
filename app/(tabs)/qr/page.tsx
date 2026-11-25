"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { useMyOrders } from "@/lib/my-orders";
import { useCart } from "@/lib/cart";
import { buildQR, checksum } from "@/lib/qr";
import { ACTIVE, DONE_VISIBLE_MIN, ORDER_EXPIRE_MIN, STATUS_LABEL, viewStatus, type ViewStatus } from "@/lib/orders";
import { describeSelection } from "@/lib/pricing";
import { prettyPhone, vnd } from "@/lib/format";
import { tierInfo } from "@/lib/tiers";
import { currentSubscription } from "@/lib/push";
import type { Order } from "@/lib/types";
import QRCode from "@/components/QRCode";
import PushCard from "@/components/PushCard";
import { ICheck } from "@/components/Icons";

const DISMISS_KEY = "moc.dismissedOrder";

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

function Items({ order }: { order: Order }) {
  return (
    <ul className="divide-y divide-line">
      {order.items.map((l, i) => (
        <li key={i} className="flex justify-between gap-3 py-2.5 text-sm">
          <span>
            <b className="text-bean-dark">{l.qty}×</b> {l.name}
            <span className="block text-xs text-muted">{describeSelection(l)}{l.note ? ` · “${l.note}”` : ""}</span>
          </span>
          <span className="shrink-0 font-medium">{vnd(l.lineTotal)}</span>
        </li>
      ))}
      <li className="flex justify-between py-2.5 font-bold text-bean-dark">
        <span>Tổng · thanh toán tại quầy</span><span>{vnd(order.total)}</span>
      </li>
    </ul>
  );
}

export default function QRPage() {
  const { phone, member } = useSession();
  const { orders, loaded } = useMyOrders();
  const cart = useCart();
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<string | null>(null);

  // đồng hồ để đơn tự "hết hạn" mà không cần tải lại
  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY));
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const latest = orders[0];
  const vs = latest ? viewStatus(latest, now) : null;
  let mode: "active" | "done" | "expired" | "none" = "none";
  if (latest && latest.id !== dismissed) {
    if (vs && ACTIVE.includes(vs as Order["status"])) mode = "active";
    else if (vs === "done" && latest.done_at && now - new Date(latest.done_at).getTime() < DONE_VISIBLE_MIN * 60_000) mode = "done";
    else if ((vs === "expired" || vs === "cancelled") && now - new Date(latest.created_at).getTime() < 3 * 3600_000) mode = "expired";
  }
  const order = mode === "none" ? null : latest;
  const qrValue = phone ? buildQR(phone, mode === "active" ? order!.code : null) : "";

  // Đã bật push từ trước → gắn subscription vào đơn đang chờ (để server gửi được)
  useEffect(() => {
    if (mode !== "active" || !order) return;
    currentSubscription().then((sub) => sub && attach(order.id, sub)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, order?.id]);

  // Giữ màn hình sáng khi đang chờ đơn
  useEffect(() => {
    if (mode !== "active") return;
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof lock> } }).wakeLock
      ?.request("screen").then((l) => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, [mode]);

  async function attach(orderId: string, subscription: PushSubscriptionJSON) {
    await fetch(`/api/orders/${orderId}/subscribe`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, subscription }),
    }).catch(() => {});
  }

  function dismiss() {
    if (!order) return;
    localStorage.setItem(DISMISS_KEY, order.id);
    setDismissed(order.id);
  }

  function reorder() {
    if (!order) return;
    cart.replace(order.items);
    dismiss();
    router.push("/order");
  }

  const isDone = mode === "done";
  const tier = tierInfo(member?.tier ?? "Mầm");

  return (
    <div className={`-mb-28 min-h-dvh px-5 pb-32 pt-safe transition-colors duration-500 ${isDone ? "bg-done" : ""}`}>
      <header className="pt-5 text-center">
        <h1 className={`text-2xl font-bold ${isDone ? "text-white" : "text-bean-dark"}`}>
          {mode === "active" ? "Mã đơn & tích điểm" : isDone ? "Đơn đã xong!" : "Mã thành viên"}
        </h1>
      </header>

      {isDone && order && (
        <div className="animate-pop mt-4 text-center text-white">
          <div className="animate-ring mx-auto grid h-20 w-20 place-items-center rounded-full bg-white text-done"><ICheck size={44} /></div>
          <div className="mt-4 text-6xl font-bold tracking-tight">#{order.code}</div>
          <p className="mt-2 text-lg font-medium">Mời bạn ra quầy nhận món ☕</p>
        </div>
      )}

      {mode === "expired" && order && (
        <div className="animate-pop mt-4 rounded-3xl border-2 border-danger/25 bg-danger-soft p-5 text-center">
          <div className="text-lg font-bold text-danger">Đơn đã hết hạn, vui lòng đặt lại</div>
          <p className="mt-1 text-sm text-danger/80">
            Đơn #{order.code} {vs === "cancelled" && (order.confirmed_at || now - new Date(order.created_at).getTime() < ORDER_EXPIRE_MIN * 60_000)
              ? "đã bị huỷ" : `chưa được quét trong ${ORDER_EXPIRE_MIN} phút`}.
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={dismiss} className="h-11 flex-1 rounded-full border-2 border-danger/25 font-semibold text-danger">Đóng</button>
            <button onClick={reorder} className="btn-primary h-11 flex-1">Đặt lại</button>
          </div>
        </div>
      )}

      {mode === "active" && order && (
        <div className="mt-4 text-center">
          <div className="text-sm font-medium text-muted">Số đơn của bạn</div>
          <div className="text-6xl font-bold leading-none tracking-tight text-bean-dark">#{order.code}</div>
          <div className="mt-2 inline-block rounded-full bg-caramel/15 px-3 py-1 text-sm font-semibold text-caramel">
            {STATUS_LABEL[vs!]}
          </div>
        </div>
      )}

      {/* MỘT mã QR duy nhất */}
      <div className={`mx-auto mt-5 w-fit rounded-[2rem] bg-white p-4 shadow-[0_20px_40px_-20px_rgba(59,36,22,0.45)] ${isDone ? "scale-90 opacity-95" : ""}`}>
        {phone && <QRCode value={qrValue} size={mode === "active" ? 232 : 248} />}
        <div className="mt-2 text-center font-mono text-xs tracking-wider text-muted">
          {phone && prettyPhone(phone)}{mode === "active" && ` · ${order!.code}`} · {phone && checksum(qrValue.split("|").slice(0, 3).join("|"))}
        </div>
      </div>
      <p className={`mx-auto mt-3 max-w-xs text-center text-sm font-medium ${isDone ? "text-white/90" : "text-bean"}`}>
        Đưa mã cho nhân viên quét: vừa lên đơn vừa tích điểm.
      </p>

      {mode === "active" && order && (
        <>
          <div className="card mt-5 p-4"><Stepper status={vs!} /></div>
          <div className="mt-3"><PushCard onSubscribed={(s) => attach(order.id, s)} /></div>
          <div className="card mt-3 px-4 py-1"><Items order={order} /></div>
        </>
      )}

      {isDone && order && (
        <button onClick={dismiss} className="mx-auto mt-6 block h-12 w-full max-w-xs rounded-full bg-white font-bold text-done">
          Tôi đã nhận món
        </button>
      )}

      {mode !== "active" && !isDone && (
        <div className="card mt-6 flex items-center justify-between p-4">
          <div>
            <div className="text-sm text-muted">Hạng {tier.name}</div>
            <div className="text-xl font-bold text-bean-dark">{member?.points ?? 0} điểm</div>
          </div>
          <button onClick={() => router.push("/order")} className="btn-primary px-5 py-3 text-sm">Đặt món trước</button>
        </div>
      )}
      {!loaded && <p className="mt-4 text-center text-xs text-muted">Đang tải đơn…</p>}
    </div>
  );
}
