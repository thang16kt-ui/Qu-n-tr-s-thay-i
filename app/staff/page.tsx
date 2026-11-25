"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { asset, staffApi, type StaffApi } from "@/lib/api";
import { parseQR } from "@/lib/qr";
import Link from "next/link";
import { sb } from "@/lib/supabase";
import { useMenu } from "@/lib/menu";
import { ACTIVE, STATUS_LABEL, orderNo, startOfTodayVN, viewStatus } from "@/lib/orders";
import { describeSelection } from "@/lib/pricing";
import { pointsFor, tierInfo } from "@/lib/tiers";
import { dateTime, prettyPhone, timeAgo, vnd } from "@/lib/format";
import type { Member, Order, OrderStatus } from "@/lib/types";
import Logo from "@/components/Logo";
import Scanner from "@/components/Scanner";
import { useToast } from "@/components/Toast";

const COLS = "id,code,ref,member_phone,items,subtotal,discount,voucher_title,total,status,created_at,confirmed_at,done_at";
const PIN_KEY = "moc.staffPin";

function useStaffApi(pin: string) {
  return useMemo(() => staffApi(pin), [pin]);
}

function OrderActions({ order, api, onDone }: { order: Order; api: StaffApi; onDone?: (o: Order) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const vs = viewStatus(order);
  async function go(status: OrderStatus) {
    if (status === "cancelled" && !confirm(`Huỷ đơn ${orderNo(order)}?`)) return;
    setBusy(true);
    try {
      const r = await api.setStatus(order.id, status);
      let msg = status === "confirmed" ? `Đã nhận đơn · cấp số #${r.order.code}` : `${orderNo(r.order)}: ${STATUS_LABEL[status]}`;
      if (r.points) msg += ` · +${r.points} điểm`;
      if (status === "done") msg += r.hadSubscription ? " · đã gửi thông báo" : " · khách không bật thông báo";
      toast(msg);
      onDone?.(r.order);
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  }
  const btn = "h-11 flex-1 rounded-full text-sm font-bold disabled:opacity-50";
  if (vs === "expired" || vs === "cancelled" || vs === "done") return null;
  return (
    <div className="mt-3 flex gap-2">
      {vs === "pending" && <button disabled={busy} onClick={() => go("confirmed")} className={`${btn} bg-bean text-cream`}>Nhận đơn · cấp số & tích {pointsFor(order.total)} điểm</button>}
      {vs === "confirmed" && <button disabled={busy} onClick={() => go("making")} className={`${btn} bg-caramel text-white`}>Bắt đầu pha</button>}
      {vs === "making" && <button disabled={busy} onClick={() => go("done")} className={`${btn} bg-done text-white`}>Đã xong ✓</button>}
      <button disabled={busy} onClick={() => go("cancelled")} className="h-11 rounded-full border-2 border-line px-4 text-sm font-semibold text-danger">Huỷ</button>
    </div>
  );
}

function OrderCard({ order, api, onDone, place }: { order: Order; api: StaffApi; onDone?: (o: Order) => void; place?: number }) {
  const vs = viewStatus(order);
  const color = vs === "done" ? "bg-done/15 text-done" : vs === "pending" ? "bg-accent-soft text-caramel" : vs === "expired" || vs === "cancelled" ? "bg-danger-soft text-danger" : "bg-caramel/15 text-caramel";
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-bean-dark">{order.code ? `#${order.code}` : `Mã ${order.ref}`}</span>
          {place !== undefined && <span className="rounded-full bg-mustard px-2 py-0.5 text-xs font-bold text-mustard-ink">Thứ {place}</span>}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${color}`}>{STATUS_LABEL[vs]}</span>
      </div>
      <div className="text-xs text-muted">{prettyPhone(order.member_phone)} · {order.confirmed_at ? `quét lúc ${dateTime(order.confirmed_at)}` : `đặt ${timeAgo(order.created_at)} · chưa vào hàng chờ`}</div>
      <ul className="mt-2 space-y-1 text-sm">
        {order.items.map((l, i) => (
          <li key={i}><b>{l.qty}×</b> {l.name}{describeSelection(l) && <span className="text-muted"> — {describeSelection(l)}</span>}{l.note && <i className="text-caramel"> “{l.note}”</i>}</li>
        ))}
      </ul>
      {!!order.discount && <div className="mt-2 text-right text-sm text-caramel">Ưu đãi: {order.voucher_title} (−{vnd(order.discount)})</div>}
      <div className="mt-1 text-right font-bold text-bean">{vnd(order.total)}</div>
      <OrderActions order={order} api={api} onDone={onDone} />
    </div>
  );
}

function ScanTab({ api }: { api: StaffApi }) {
  const toast = useToast();
  const [camera, setCamera] = useState(false);
  const [manual, setManual] = useState("");
  const [res, setRes] = useState<{ member: Member; order: Order | null; orderCode: string | null } | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const scan = useCallback(async (text: string) => {
    setCamera(false);
    try {
      const q = parseQR(text);
      if (!q.ok) throw new Error(q.error);
      setRes(await api.scan(q.phone, q.orderCode));
      setAmount("");
    } catch (e) { toast((e as Error).message); }
  }, [api, toast]);

  async function addPoints() {
    if (!res) return;
    setBusy(true);
    try {
      const r = await api.addPoints(res.member.phone, Number(amount.replace(/\D/g, "")));
      toast(`+${r.points} điểm cho ${prettyPhone(res.member.phone)}`);
      setRes({ ...res, member: r.member });
      setAmount("");
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setCamera(true)} className="btn-primary h-16 w-full text-lg">📷 Quét mã QR của khách</button>
      <form onSubmit={(e) => { e.preventDefault(); scan(manual); }} className="flex gap-2">
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="hoặc dán chuỗi MOC|09…|A12|7K"
          className="h-12 flex-1 rounded-2xl border-2 border-line bg-paper px-4 font-mono text-sm outline-none focus:border-caramel" />
        <button className="rounded-2xl bg-cream-2 px-4 font-semibold text-bean">Tra</button>
      </form>

      {res && (
        <div className="space-y-3">
          <div className="card flex items-center justify-between p-4">
            <div>
              <div className="font-bold text-bean-dark">{res.member.name || "Khách"} · {prettyPhone(res.member.phone)}</div>
              <div className="text-sm text-muted">Hạng {tierInfo(res.member.tier).name} · {res.member.points} điểm</div>
            </div>
            <button onClick={() => setRes(null)} className="text-sm text-muted">Xoá</button>
          </div>
          {res.orderCode && !res.order && <p className="rounded-2xl bg-danger-soft p-3 text-sm text-danger">Không tìm thấy đơn #{res.orderCode}.</p>}
          {res.order && <OrderCard order={res.order} api={api} onDone={async (o) => {
            setRes({ ...res, order: o });
            api.scan(res.member.phone, o.code ?? o.ref ?? null).then(setRes).catch(() => {});
          }} />}
          {(!res.order || !ACTIVE.includes(res.order.status)) && (
            <div className="card p-4">
              <div className="font-semibold text-bean-dark">Tích điểm hoá đơn tại quầy</div>
              <div className="mt-2 flex gap-2">
                <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Số tiền, vd 85000"
                  className="h-12 flex-1 rounded-2xl border-2 border-line bg-paper px-4 outline-none focus:border-caramel" />
                <button disabled={busy || !amount} onClick={addPoints} className="btn-primary px-5">Cộng</button>
              </div>
              <div className="mt-1 text-xs text-muted">= {pointsFor(Number(amount.replace(/\D/g, "")) || 0)} điểm (10.000đ = 1 điểm)</div>
            </div>
          )}
        </div>
      )}
      {camera && <Scanner onResult={scan} onClose={() => setCamera(false)} />}
    </div>
  );
}

function BoardTab({ api }: { api: StaffApi }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [, tick] = useState(0);
  useEffect(() => {
    // Chỉ đơn ĐÃ QUÉT tại quầy (có giờ nhận đơn) — đơn đặt trên app chưa đến quầy không hiện ở đây
    sb().from("orders").select(COLS).gte("confirmed_at", startOfTodayVN()).order("confirmed_at", { ascending: true }).limit(150)
      .then(({ data }) => setOrders((data ?? []) as Order[]));
    const ch = sb().channel("staff-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) => {
        const o = p.new as Order;
        if (!o?.id) return;
        setOrders((prev) => [...prev.filter((x) => x.id !== o.id), o]);
      }).subscribe();
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => { sb().removeChannel(ch); clearInterval(t); };
  }, []);
  const groups = useMemo(() => {
    const scanned = orders.filter((o) => o.confirmed_at);
    const byScan = (a: Order, b: Order) => a.confirmed_at!.localeCompare(b.confirmed_at!);
    return {
      active: scanned.filter((o) => o.status === "confirmed" || o.status === "making").sort(byScan),
      done: scanned.filter((o) => o.status === "done").sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? "")).slice(0, 8),
    };
  }, [orders]);
  const cols: ["active" | "done", string][] = [["active", "Đơn"], ["done", "Đã xong"]];
  return (
    <div className="space-y-6">
      {cols.map(([k, label]) => (
        <section key={k}>
          <h3 className="mb-2 font-bold text-bean-dark">{label} <span className="text-muted">({groups[k].length})</span></h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {groups[k].map((o, i) => <OrderCard key={o.id} order={o} api={api} place={k === "active" ? i + 1 : undefined} />)}
            {groups[k].length === 0 && <p className="text-sm text-muted">—</p>}
          </div>
        </section>
      ))}
    </div>
  );
}

function MenuTab({ api }: { api: StaffApi }) {
  const { items } = useMenu();
  const toast = useToast();
  return (
    <ul className="card divide-y divide-line px-4">
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-3 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset(it.image)} alt="" className={`h-12 w-12 rounded-xl ${it.available ? "" : "grayscale opacity-60"}`} />
          <div className="flex-1">
            <div className="font-semibold text-bean-dark">{it.name}</div>
            <div className="text-xs text-muted">{it.category} · {vnd(it.price)}</div>
          </div>
          <button onClick={() => api.setAvailable(it.id, !it.available).catch((e) => toast(e.message))}
            className={`relative h-8 w-14 rounded-full transition ${it.available ? "bg-done" : "bg-line"}`} aria-label="Còn hàng">
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${it.available ? "left-7" : "left-1"}`} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function StaffPage() {
  const [pin, setPin] = useState("");
  const [ok, setOk] = useState(false);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"scan" | "board" | "menu">("scan");
  const api = useStaffApi(pin);

  useEffect(() => {
    const saved = sessionStorage.getItem(PIN_KEY);
    if (saved) { setPin(saved); setOk(true); }
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    try { await staffApi(input).check(); } catch { return setErr("Sai mã PIN"); }
    sessionStorage.setItem(PIN_KEY, input);
    setPin(input); setOk(true);
  }

  if (!ok) {
    return (
      <main className="mx-auto max-w-sm px-6 pt-24">
        <Logo size={52} withText />
        <h1 className="mt-8 text-2xl font-bold text-bean-dark">Màn hình nhân viên</h1>
        <form onSubmit={login} className="mt-6">
          <input type="password" inputMode="numeric" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Mã PIN"
            className="h-14 w-full rounded-2xl border-2 border-line bg-paper px-4 text-center text-2xl tracking-[0.5em] outline-none focus:border-caramel" />
          {err && <p className="mt-2 text-sm text-danger">{err}</p>}
          <button className="btn-primary mt-4 h-12 w-full">Vào</button>
        </form>
        <Link href="/home" className="mt-6 block text-center text-sm text-muted underline">← Về app khách</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pb-16 pt-safe">
      <header className="flex items-center justify-between py-5">
        <Logo size={40} withText />
        <span className="rounded-full bg-bean px-3 py-1 text-xs font-bold text-cream">NHÂN VIÊN</span>
      </header>
      <div className="mb-5 grid grid-cols-3 rounded-full bg-cream-2 p-1">
        {([["scan", "Quét mã"], ["board", "Đơn hôm nay"], ["menu", "Thực đơn"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full py-2.5 text-sm font-semibold ${tab === k ? "bg-paper text-bean-dark shadow-sm" : "text-muted"}`}>{label}</button>
        ))}
      </div>
      {tab === "scan" && <ScanTab api={api} />}
      {tab === "board" && <BoardTab api={api} />}
      {tab === "menu" && <MenuTab api={api} />}
    </main>
  );
}
