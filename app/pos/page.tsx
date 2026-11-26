"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StaffGate, { useStaff } from "@/components/staff/StaffGate";
import { CupLabels, LineText, MemberBadge, OptionPicker } from "@/components/staff/parts";
import Scanner from "@/components/Scanner";
import { useToast } from "@/components/Toast";
import { asset, type OrderInput } from "@/lib/api";
import { normalizePhone, vnd } from "@/lib/format";
import { useMenu } from "@/lib/menu";
import { PAYMENT_LABEL, STAFF_COLS, orderNo, startOfTodayVN, viewStatus, type ViewStatus } from "@/lib/orders";
import { parseQR } from "@/lib/qr";
import { beep, buzz } from "@/lib/sound";
import { sb } from "@/lib/supabase";
import { pointsFor } from "@/lib/tiers";
import { CATEGORIES, type Category, type Member, type MenuItem, type Order, type OrderLine } from "@/lib/types";
import { IMinus, IPlus, IQR } from "@/components/Icons";

// ---------------------------------------------------------------------------
// Trạng thái đơn (cách gọi của nhân viên)
// ---------------------------------------------------------------------------
const STAFF_LABEL: Record<ViewStatus, string> = {
  pending: "Chờ quầy", confirmed: "Ở Cn", making: "Ở Cn", done: "Đã gọi khách", cancelled: "Đã huỷ", expired: "Hết hạn",
};
const STAFF_COLOR: Record<ViewStatus, string> = {
  pending: "bg-mustard/40 text-mustard-ink", confirmed: "bg-accent-soft text-caramel", making: "bg-accent-soft text-caramel",
  done: "bg-done/15 text-done", cancelled: "bg-danger-soft text-danger", expired: "bg-danger-soft text-danger",
};
function StatusPill({ o, big }: { o: Order; big?: boolean }) {
  const vs = viewStatus(o);
  const label = vs === "pending" && o.scanned_at ? "Chờ thu tiền" : STAFF_LABEL[vs];
  return <span className={`shrink-0 whitespace-nowrap rounded-full font-bold ${big ? "px-4 py-1.5 text-sm" : "px-2.5 py-1 text-xs"} ${STAFF_COLOR[vs]}`}>{label}</span>;
}
const hhmm = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "");
const SOURCE: Record<string, string> = { app: "Đặt trên app", counter: "Tạo tại quầy", demo: "Đơn giả lập" };

// ---------------------------------------------------------------------------
// Đơn hôm nay (realtime)
// ---------------------------------------------------------------------------
function useTodayOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  // Cập nhật ngay sau thao tác ở quầy (không chờ realtime)
  const put = useCallback((o: Order) =>
    setOrders((prev) => [o, ...prev.filter((x) => x.id !== o.id)].sort((a, b) => b.created_at.localeCompare(a.created_at))), []);
  const [, tick] = useState(0);
  useEffect(() => {
    const load = () => {
      const since = startOfTodayVN();
      sb().from("orders").select(STAFF_COLS)
        .or(`created_at.gte."${since}",confirmed_at.gte."${since}"`)
        .order("created_at", { ascending: false }).limit(300)
        .then(({ data }) => setOrders((data ?? []) as Order[]));
    };
    load();
    const ch = sb().channel("pos-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) => {
        if (p.eventType === "DELETE") {
          const id = (p.old as { id?: string }).id;
          setOrders((prev) => prev.filter((o) => o.id !== id));
          return;
        }
        const o = p.new as Order;
        if (!o?.id) return;
        setOrders((prev) => [o, ...prev.filter((x) => x.id !== o.id)].sort((a, b) => b.created_at.localeCompare(a.created_at)));
      })
      .subscribe();
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => tick((n) => n + 1), 30_000); // cập nhật "hết hạn"
    // Dự phòng khi realtime bị ngắt (hay gặp trên điện thoại): tải lại mỗi 5 giây khi trang đang mở
    const poll = setInterval(() => document.visibilityState === "visible" && load(), 5_000);
    return () => { sb().removeChannel(ch); document.removeEventListener("visibilitychange", onVis); clearInterval(t); clearInterval(poll); };
  }, []);
  return { orders, put };
}

// ---------------------------------------------------------------------------
type Panel =
  | { kind: "idle" }
  | { kind: "member"; member: Member; pending: Order | null }
  | { kind: "order"; member: Member | null; order: Order; notice?: { tone: "warn" | "error" | "info"; text: string }; paid?: { points: number } }
  | { kind: "sell"; member: Member | null }
  | { kind: "edit"; member: Member | null; order: Order }
  | { kind: "points"; member: Member };

type Flash = { tone: "ok" | "err"; text: string; n: number };

export default function PosPage() {
  return (
    <StaffGate page="pos" title="Quầy">
      <Pos />
    </StaffGate>
  );
}

function Pos() {
  const { api } = useStaff();
  const toast = useToast();
  const { items: menu } = useMenu();
  const { orders: today, put } = useTodayOrders();
  // Đơn khách đặt trên app KHÔNG tự hiện ở quầy: chỉ mở được bằng cách quét mã của khách.
  // Danh sách "Đơn hôm nay" chỉ gồm đơn đã nhận (xác nhận) tại quầy.
  // (đơn đã quét ở bất kỳ máy POS nào cũng hiện ở mọi máy — nhãn "Chờ thu tiền")
  const received = useMemo(() => today.filter((o) => o.confirmed_at || o.scanned_at)
    .sort((a, b) => (b.confirmed_at ?? b.scanned_at ?? "").localeCompare(a.confirmed_at ?? a.scanned_at ?? "")), [today]);
  const [panel, setPanel] = useState<Panel>({ kind: "idle" });
  const panelRef = useRef(panel);
  panelRef.current = panel;
  // Điện thoại: xem một cột mỗi lúc — "Quầy" hoặc "Đơn hôm nay"
  const [view, setView] = useState<"work" | "list">("work");
  useEffect(() => { setView("work"); }, [panel]);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [camera, setCamera] = useState(false);
  const [scan, setScan] = useState("");
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [print, setPrint] = useState<{ order: Order; n: number } | null>(null);
  const [autoPrint, setAutoPrint] = useState(true);
  const scanRef = useRef<HTMLInputElement>(null);
  const last = useRef({ text: "", at: 0 });

  const show = useCallback((tone: Flash["tone"], text: string) => setFlash({ tone, text, n: Date.now() }), []);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => { setAutoPrint(localStorage.getItem("moc.autoPrint") !== "0"); }, []);
  const toggleAutoPrint = () => { localStorage.setItem("moc.autoPrint", autoPrint ? "0" : "1"); setAutoPrint(!autoPrint); };

  // In tem: đặt dữ liệu tem rồi gọi hộp thoại in của trình duyệt
  useEffect(() => {
    if (!print) return;
    const t = setTimeout(() => window.print(), 200);
    return () => clearTimeout(t);
  }, [print]);

  // ---- Ô quét luôn được focus (máy quét USB/Bluetooth gõ như bàn phím) ----
  const focusScan = useCallback(() => {
    if (camera) return;
    const a = document.activeElement as HTMLElement | null;
    if (a && a !== document.body && a !== scanRef.current &&
        (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)) return;
    if (a !== scanRef.current) scanRef.current?.focus({ preventScroll: true });
  }, [camera]);

  useEffect(() => {
    focusScan();
    const later = () => setTimeout(focusScan, 0);
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement === document.body && e.key.length === 1 && !e.ctrlKey && !e.metaKey) scanRef.current?.focus();
    };
    document.addEventListener("pointerup", later);
    document.addEventListener("focusout", later);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("afterprint", later);
    const t = setInterval(focusScan, 1500);
    return () => {
      document.removeEventListener("pointerup", later);
      document.removeEventListener("focusout", later);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("afterprint", later);
      clearInterval(t);
    };
  }, [focusScan]);

  // ---- Tra cứu sau khi quét ----
  const lookup = useCallback(async (phone: string, code: string | null) => {
    setBusy(true);
    try {
      const r = await api.scan(phone, code);
      // Đang bán tại quầy mà quét mã thành viên → gắn khách vào đơn để tích điểm
      if (!code && panelRef.current.kind === "sell") {
        beep(); show("ok", `Tích điểm cho •••• ${phone.slice(-4)}`);
        setPanel({ kind: "sell", member: r.member });
        return;
      }
      if (code) {
        if (!r.order) {
          buzz(); show("err", `Không tìm thấy đơn ${code}`);
          setPanel({ kind: "member", member: r.member, pending: null });
          return;
        }
        const vs = viewStatus(r.order);
        if (vs === "pending") {
          beep(); show("ok", `Đơn ${orderNo(r.order)} · ${r.order.items.reduce((s, l) => s + l.qty, 0)} món`);
          setPanel({ kind: "order", member: r.member, order: r.order });
        } else if (vs === "cancelled" || vs === "expired") {
          buzz(); show("err", "Đơn đã huỷ / hết hạn");
          setPanel({ kind: "order", member: r.member, order: r.order,
            notice: { tone: "error", text: "Đơn đã huỷ hoặc quá 30 phút chưa đến quầy. Mời khách đặt lại, hoặc bấm “Tạo đơn tại quầy”." } });
        } else {
          buzz(); show("err", "Đơn đã được xác nhận");
          setPanel({ kind: "order", member: r.member, order: r.order,
            notice: { tone: "warn", text: `Đơn đã được xác nhận lúc ${hhmm(r.order.confirmed_at)} — không thu tiền / cộng điểm lần nữa.` } });
        }
      } else {
        beep(); show("ok", `Thành viên •••• ${phone.slice(-4)}`);
        const p = r.pendingOrder && viewStatus(r.pendingOrder) === "pending" ? r.pendingOrder : null;
        setPanel({ kind: "member", member: r.member, pending: p });
      }
    } catch (e) {
      buzz(); show("err", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [api, show]);

  const handle = useCallback((raw: string) => {
    const text = raw.trim();
    setScan("");
    if (!text) return;
    const now = Date.now();
    if (text === last.current.text && now - last.current.at < 3000) return; // máy quét đọc lặp
    last.current = { text, at: now };
    let phone: string | null;
    let code: string | null = null;
    if (/^moc/i.test(text)) {
      const q = parseQR(text);
      if (!q.ok) { buzz(); show("err", "Không đọc được mã"); return; }
      phone = q.phone; code = q.orderCode;
    } else {
      phone = normalizePhone(text);
      if (!phone) { buzz(); show("err", "Không đọc được mã"); return; }
    }
    lookup(phone, code);
  }, [lookup, show]);

  const onCamera = useCallback((text: string) => { setCamera(false); handle(text); }, [handle]);

  // Mở từ /admin (Giả lập khách đặt đơn → "Mở ở quầy")
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("scan");
    if (s) { window.history.replaceState(null, "", window.location.pathname); handle(s); }
  }, [handle]);

  // ---- Đồng bộ giữa các máy /pos: máy khác (điện thoại / máy tính) vừa quét mã đơn → máy này tự mở đơn đó ----
  const mountedAt = useRef(Date.now());
  const seenScan = useRef(new Map<string, string>());
  useEffect(() => {
    for (const o of today) {
      if (!o.scanned_at || o.status !== "pending") continue;
      if (seenScan.current.get(o.id) === o.scanned_at) continue;
      seenScan.current.set(o.id, o.scanned_at);
      if (new Date(o.scanned_at).getTime() < mountedAt.current - 5000) continue; // quét trước khi mở trang
      const p = panelRef.current;
      if (p.kind === "order" && p.order.id === o.id) continue; // chính máy này vừa quét
      // Đang chọn món / đang thu tiền đơn khác → không cắt ngang, chỉ báo
      const busyHere = p.kind === "edit" || p.kind === "sell" || p.kind === "points" ||
        (p.kind === "order" && viewStatus(p.order) === "pending");
      beep();
      if (busyHere) { show("ok", `Đơn ${o.ref} vừa được quét · mở trong Đơn hôm nay`); continue; }
      show("ok", `Đơn ${o.ref} vừa được quét · ${o.items.reduce((n, l) => n + l.qty, 0)} món`);
      const open = (member: Member | null) => setPanel({ kind: "order", member, order: o });
      if (!o.member_phone) { open(null); continue; }
      sb().from("members").select("*").eq("phone", o.member_phone).maybeSingle()
        .then(({ data }) => open((data as Member | null) ?? null), () => open(null));
    }
  }, [today, show]);

  // Đơn đang mở cập nhật theo realtime (vd Cn bấm Gọi khách)
  useEffect(() => {
    setPanel((p) => {
      if (p.kind !== "order") return p;
      const u = today.find((o) => o.id === p.order.id);
      return u && (u.status !== p.order.status || u.code !== p.order.code) ? { ...p, order: { ...p.order, ...u } } : p;
    });
  }, [today]);

  async function openOrder(o: Order) {
    if (!o.member_phone) { setPanel({ kind: "order", member: null, order: o }); return; }
    try {
      const r = await api.scan(o.member_phone, o.code ?? o.ref ?? null);
      setPanel({ kind: "order", member: r.member, order: r.order ?? o });
    } catch (e) { toast((e as Error).message); }
  }

  async function pay(order: Order, method: "cash" | "transfer", edited?: boolean) {
    setBusy(true);
    try {
      // Món sửa ở quầy chỉ được ghi vào đơn lúc xác nhận
      const r = await api.confirm(order.id, method, edited ? order.items.map(toInput) : undefined);
      beep();
      show("ok", `Đã thu ${vnd(r.order.total)} · Số đơn #${r.order.code}`);
      put(r.order);
      setPanel({ kind: "order", member: r.member, order: r.order, paid: { points: r.points } });
      if (autoPrint) setPrint({ order: r.order, n: Date.now() });
    } catch (e) {
      const msg = (e as Error).message;
      buzz(); show("err", msg);
      if (/xác nhận|huỷ/.test(msg)) openOrder(order);
    }
    setBusy(false);
  }

  async function sell(member: Member | null, lines: OrderLine[], method: "cash" | "transfer") {
    setBusy(true);
    try {
      const r = await api.sell(member?.phone ?? null, lines.map(toInput), method);
      beep();
      show("ok", `Đã thu ${vnd(r.order.total)} · Số đơn #${r.order.code}`);
      put(r.order);
      setPanel({ kind: "order", member: r.member?.phone ? r.member : null, order: r.order, paid: { points: r.points } });
      if (autoPrint) setPrint({ order: r.order, n: Date.now() });
    } catch (e) { buzz(); show("err", (e as Error).message); }
    setBusy(false);
  }

  async function cancel(order: Order) {
    if (!window.confirm(`Huỷ đơn ${orderNo(order)}?${order.confirmed_at ? " Điểm đã cộng sẽ bị trừ lại." : ""}`)) return;
    setBusy(true);
    try {
      const r = await api.cancel(order.id);
      put(r.order);
      toast(`Đã huỷ ${orderNo(r.order)}${r.points ? ` · trừ ${-r.points} điểm` : ""}`);
      setPanel({ kind: "idle" });
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  }

  const lookupManual = (e: React.FormEvent) => {
    e.preventDefault();
    const p = normalizePhone(manual);
    if (!p) { buzz(); show("err", "SĐT không hợp lệ (10 số, bắt đầu bằng 0)"); return; }
    setManual("");
    (document.activeElement as HTMLElement | null)?.blur();
    last.current = { text: p, at: Date.now() };
    lookup(p, null);
  };

  const ring = flash ? (flash.tone === "ok" ? "border-done" : "border-caramel") : "border-line";

  return (
    <div className="flex flex-col lg:h-full lg:flex-row">
      <div className="sticky top-[92px] z-20 flex gap-1 border-b border-line bg-cream-2 px-3 py-2 lg:hidden">
        {(["work", "list"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`h-10 flex-1 rounded-full text-sm font-bold ${view === v ? "bg-bean text-cream" : "bg-paper text-bean-dark"}`}>
            {v === "work" ? "Xử lý đơn" : `Đơn hôm nay (${received.length})`}
          </button>
        ))}
      </div>
      {/* ------------------------- Cột trái: quét + xử lý ------------------------- */}
      <section className={`relative min-w-0 flex-1 flex-col ${view === "work" ? "flex" : "hidden lg:flex"}`}>
        {flash && <div key={flash.n} className={`pointer-events-none absolute inset-0 z-10 ${flash.tone === "ok" ? "flash-green" : "flash-red"}`} />}
        <div className="flex flex-wrap items-center gap-2 p-3 pb-1 lg:flex-nowrap lg:gap-3 lg:p-4 lg:pb-2">
          <label className={`flex h-12 w-full items-center gap-3 rounded-2xl lg:h-14 lg:w-auto lg:flex-1 border-2 bg-paper px-4 transition-colors ${ring}`}>
            <span className={`h-3 w-3 shrink-0 rounded-full ${busy ? "bg-mustard" : "animate-pulse bg-done"}`} />
            <input
              ref={scanRef} value={scan} inputMode="none" autoComplete="off" autoCorrect="off" spellCheck={false}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || (e.key === "Tab" && scan)) { e.preventDefault(); handle(scan); }
              }}
              placeholder="Sẵn sàng quét — máy quét 2D tự nhập mã và Enter"
              className="min-w-0 flex-1 bg-transparent font-mono text-base outline-none placeholder:font-sans placeholder:text-muted" />
          </label>
          <button onClick={() => setPanel({ kind: "sell", member: null })} className="flex h-12 flex-1 items-center justify-center whitespace-nowrap rounded-2xl bg-done px-3 text-sm font-bold text-white lg:h-14 lg:flex-none lg:px-5 lg:text-base">
            ＋ Bán tại quầy
          </button>
          <button onClick={() => setCamera(true)} className="btn-primary flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 text-sm lg:h-14 lg:flex-none lg:px-5 lg:text-base">
            <IQR size={22} /> <span className="lg:hidden">Camera</span><span className="hidden lg:inline">Quét bằng camera</span>
          </button>
          <form onSubmit={lookupManual} className="flex h-12 w-full items-center rounded-2xl border-2 border-line bg-paper pl-3 lg:h-14 lg:w-auto lg:shrink-0">
            <input value={manual} onChange={(e) => setManual(e.target.value)} inputMode="numeric" placeholder="Nhập SĐT tay"
              className="min-w-0 flex-1 bg-transparent text-base outline-none lg:w-36 lg:flex-none" />
            <button className="mr-1.5 h-10 rounded-xl bg-cream-2 px-3 text-sm font-bold text-bean">Tra</button>
          </form>
        </div>
        <div className="min-h-2 px-3 lg:h-9 lg:px-4">
          {flash && (
            <div className={`animate-pop inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-base font-bold ${flash.tone === "ok" ? "bg-done text-white" : "bg-caramel text-white"}`}>
              {flash.tone === "ok" ? "✓" : "✕"} {flash.text}
            </div>
          )}
        </div>

        <div className="px-3 pb-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-4 lg:pb-4">
          {panel.kind === "idle" && <Idle onCamera={() => setCamera(true)} onSell={() => setPanel({ kind: "sell", member: null })} />}
          {panel.kind === "member" && (
            <MemberPanel panel={panel} onOpen={(o) => setPanel({ kind: "order", member: panel.member, order: o })}
              onCreate={() => setPanel({ kind: "sell", member: panel.member })}
              onPoints={() => setPanel({ kind: "points", member: panel.member })}
              onClose={() => setPanel({ kind: "idle" })} />
          )}
          {panel.kind === "order" && (
            <OrderPanel key={panel.order.id} panel={panel} busy={busy}
              onPay={(m) => pay(panel.order, m)} onCancel={() => cancel(panel.order)}
              onPrint={() => setPrint({ order: panel.order, n: Date.now() })}
              onNext={() => setPanel({ kind: "idle" })}
              onCreate={() => setPanel({ kind: "sell", member: panel.member })}
              onEdit={() => setPanel({ kind: "edit", member: panel.member, order: panel.order })} />
          )}
          {panel.kind === "edit" && (
            <CreateOrder key={panel.order.id} member={panel.member} menu={menu} order={panel.order} busy={busy}
              onBack={() => setPanel({ kind: "order", member: panel.member, order: panel.order })}
              onConfirm={(lines, m) => pay({ ...panel.order, items: lines }, m, true)} />
          )}
          {panel.kind === "sell" && (
            <CreateOrder member={panel.member} menu={menu} busy={busy}
              onBack={() => setPanel(panel.member ? { kind: "member", member: panel.member, pending: null } : { kind: "idle" })}
              onClearMember={() => setPanel({ kind: "sell", member: null })}
              onConfirm={(lines, m) => sell(panel.member, lines, m)} />
          )}
          {panel.kind === "points" && (
            <PointsOnly member={panel.member} onBack={() => setPanel({ kind: "member", member: panel.member, pending: null })}
              onNext={() => setPanel({ kind: "idle" })} />
          )}
        </div>
      </section>

      {/* ------------------------- Cột phải: đơn hôm nay ------------------------- */}
      <TodayList hidden={view !== "list"} orders={received} current={panel.kind === "order" ? panel.order.id : null} onOpen={openOrder}
        autoPrint={autoPrint} onToggleAutoPrint={toggleAutoPrint} />

      {camera && <Scanner onResult={onCamera} onClose={() => setCamera(false)} title="Quét mã QR trên app của khách" />}
      <CupLabels key={print?.n} order={print?.order ?? null} menu={menu} />
    </div>
  );
}

// ---------------------------------------------------------------------------
function Idle({ onCamera, onSell }: { onCamera: () => void; onSell: () => void }) {
  return (
    <div className="grid place-items-center py-4 lg:h-full lg:py-0">
      <div className="max-w-xl text-center">
        <div className="mx-auto hidden h-28 w-28 lg:grid place-items-center rounded-[2rem] bg-paper text-caramel shadow-sm"><IQR size={56} /></div>
        <h2 className="text-2xl font-bold text-bean-dark lg:mt-6 lg:text-3xl">Quét mã QR của khách</h2>
        <p className="mt-3 text-base text-muted lg:text-lg">
          Máy quét 2D đã sẵn sàng — chỉ cần quét. Không có máy quét thì bấm <button onClick={onCamera} className="font-bold text-caramel underline">Quét bằng camera</button>,
          hoặc nhập SĐT tay nếu mã bị lỗi.
        </p>
        <button onClick={onSell} className="btn-primary mx-auto mt-6 flex h-16 items-center gap-2 px-8 text-xl">
          ＋ Bán tại quầy
        </button>
        <div className="mt-2 text-sm text-muted">Khách gọi món trực tiếp, không cần app</div>
        <div className="mt-8 grid grid-cols-1 gap-3 text-left text-sm sm:grid-cols-3">
          {[
            ["Mã có đơn", "Mở đơn, đối chiếu món & tổng tiền, rồi Xác nhận & thu tiền."],
            ["Mã thành viên", "Chọn món cho khách và tích điểm, hoặc chỉ tích điểm."],
            ["Tích điểm", "1 điểm / 10.000đ, mỗi đơn chỉ cộng đúng 1 lần."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl bg-paper p-4">
              <div className="font-bold text-bean-dark">{t}</div>
              <div className="mt-1 text-muted">{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MemberPanel({ panel, onOpen, onCreate, onPoints, onClose }: {
  panel: Extract<Panel, { kind: "member" }>; onOpen: (o: Order) => void; onCreate: () => void; onPoints: () => void; onClose: () => void;
}) {
  const big = "flex h-28 sm:h-40 flex-col items-center justify-center gap-2 rounded-3xl text-center shadow-sm active:scale-[0.98] transition";
  return (
    <div className="mx-auto max-w-3xl space-y-5 pt-2">
      <MemberBadge member={panel.member} big />
      {panel.pending && (
        <button onClick={() => onOpen(panel.pending!)} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-mustard bg-mustard/20 p-4 text-left sm:p-5">
          <div>
            <div className="text-lg font-bold text-bean-dark">Khách có đơn đặt trước · mã {panel.pending.ref}</div>
            <div className="text-muted">{panel.pending.items.map((l) => `${l.qty} ${l.name}`).join(", ")} · {vnd(panel.pending.total)}</div>
          </div>
          <span className="rounded-full bg-bean px-5 py-3 font-bold text-cream">Mở đơn →</span>
        </button>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <button onClick={onCreate} className={`${big} bg-bean text-cream`}>
          <span className="text-2xl font-bold">Tạo đơn tại quầy</span>
          <span className="text-cream/75">Chọn món từ thực đơn</span>
        </button>
        <button onClick={onPoints} className={`${big} bg-paper text-bean-dark`}>
          <span className="text-2xl font-bold">Chỉ tích điểm</span>
          <span className="text-muted">Nhập số tiền hoá đơn</span>
        </button>
      </div>
      <button onClick={onClose} className="mx-auto block text-sm font-semibold text-muted underline">Bỏ qua · khách tiếp theo</button>
    </div>
  );
}

function OrderPanel({ panel, busy, onPay, onCancel, onPrint, onNext, onCreate, onEdit }: {
  panel: Extract<Panel, { kind: "order" }>; busy: boolean;
  onPay: (m: "cash" | "transfer") => void; onCancel: () => void; onPrint: () => void; onNext: () => void; onCreate: () => void; onEdit: () => void;
}) {
  const { order, member, notice, paid } = panel;
  const vs = viewStatus(order);
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const count = order.items.reduce((s, l) => s + l.qty, 0);
  const canCancel = vs === "pending" || vs === "confirmed" || vs === "making";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:h-full lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="card flex flex-col p-4 lg:min-h-0 lg:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-muted">{order.code ? "Số đơn" : "Mã đơn tạm"}</div>
            <div className="text-4xl font-bold leading-none tracking-tight text-bean-dark lg:text-5xl">{order.code ? `#${order.code}` : order.ref}</div>
            <div className="mt-2 text-sm text-muted">
              {SOURCE[order.source ?? "app"] ?? "Đặt trên app"} · đặt lúc {hhmm(order.created_at)}
              {order.payment_method && ` · ${PAYMENT_LABEL[order.payment_method]} lúc ${hhmm(order.paid_at)}`}
            </div>
          </div>
          <StatusPill o={order} big />
        </div>
        <ul className="mt-4 divide-y divide-line border-y border-line lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {order.items.map((l, i) => (
            <li key={i} className="flex items-start justify-between gap-4 py-3">
              <LineText line={l} large />
              <div className="shrink-0 text-right">
                <div className="text-lg font-semibold tabular-nums">{vnd(l.lineTotal)}</div>
                {l.qty > 1 && <div className="text-xs text-muted">{vnd(l.unitPrice)} / món</div>}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 text-lg">
          <div className="flex justify-between text-muted"><span>{count} món · tạm tính</span><span className="tabular-nums">{vnd(order.subtotal ?? order.total)}</span></div>
          {!!order.discount && <div className="flex justify-between text-caramel"><span>Ưu đãi: {order.voucher_title}</span><span className="tabular-nums">−{vnd(order.discount)}</span></div>}
          <div className="flex items-baseline justify-between"><span className="font-bold text-bean-dark">Tổng cộng</span><span className="text-3xl font-bold tabular-nums text-bean-dark lg:text-4xl">{vnd(order.total)}</span></div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:min-h-0">
        {member ? <MemberBadge member={member} /> : (
          <div className="rounded-3xl bg-paper p-4 text-center font-bold text-bean-dark">Khách vãng lai · không tích điểm</div>
        )}
        {notice && (
          <div className={`rounded-2xl p-4 font-semibold ${notice.tone === "error" ? "bg-caramel text-white" : notice.tone === "info" ? "bg-accent-soft text-bean-dark" : "bg-mustard/40 text-mustard-ink"}`}>
            <div className="text-lg font-bold">{notice.tone === "error" ? "Không dùng được mã này" : notice.tone === "info" ? "Đã sửa món (chưa lưu)" : "Đơn đã được xác nhận"}</div>
            <div className="mt-1 text-sm">{notice.text}</div>
          </div>
        )}
        {paid && (
          <div className="animate-pop rounded-2xl bg-done p-4 text-white">
            <div className="text-lg font-bold">✓ Đã thu {vnd(order.total)}</div>
            <div className="mt-1 text-sm text-white/90">
              {order.payment_method && PAYMENT_LABEL[order.payment_method]}{member ? ` · +${paid.points} điểm` : ""} · đơn #{order.code} đã chuyển sang Cn
            </div>
          </div>
        )}

        <div className="mt-auto space-y-3">
          {vs === "pending" && (
            <>
              <button disabled={busy} onClick={onEdit} className="h-14 w-full rounded-2xl border-2 border-bean bg-paper text-lg font-bold text-bean-dark active:scale-[0.98]">
                ＋ Thêm món cho khách
              </button>
              <div className="grid grid-cols-2 gap-2">
                {(["cash", "transfer"] as const).map((m) => (
                  <button key={m} onClick={() => setMethod(m)}
                    className={`h-14 rounded-2xl border-2 text-base font-bold ${method === m ? "border-bean bg-bean text-cream" : "border-line bg-paper text-bean-dark"}`}>
                    {m === "cash" ? "💵 " : "🏦 "}{PAYMENT_LABEL[m]}
                  </button>
                ))}
              </div>
              <button disabled={busy} onClick={() => onPay(method)} className="h-20 w-full rounded-3xl bg-done text-xl font-bold text-white shadow-lg active:scale-[0.98] disabled:opacity-60">
                Xác nhận
                <div className="text-sm font-semibold text-white/85">{vnd(order.total)} · +{pointsFor(order.total)} điểm</div>
              </button>
            </>
          )}
          {(vs === "cancelled" || vs === "expired") && (
            <button onClick={onCreate} className="btn-primary h-16 w-full text-lg">Tạo đơn tại quầy</button>
          )}
          {order.code && vs !== "cancelled" && (
            <button onClick={onPrint} className="h-12 w-full rounded-2xl border-2 border-line bg-paper font-bold text-bean-dark">🖨 In {paid ? "lại " : ""}tem dán ly</button>
          )}
          <div className="flex gap-2">
            {canCancel && (
              <button disabled={busy} onClick={onCancel} className="h-12 flex-1 rounded-2xl border-2 border-line bg-paper font-bold text-danger">Huỷ đơn</button>
            )}
            <button onClick={onNext} className={`h-12 flex-[2] rounded-2xl font-bold ${paid ? "bg-bean text-cream" : "bg-cream text-bean-dark border-2 border-line"}`}>
              {paid ? "Khách tiếp theo →" : "Đóng"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
const toInput = (l: OrderLine): OrderInput => ({ itemId: l.itemId, qty: l.qty, size: l.size, sugar: l.sugar, ice: l.ice, toppings: l.toppings, note: l.note });
const hasOptions = (m: MenuItem) => {
  const o = m.options || {};
  return !!(o.sizes?.length || o.sugar?.length || o.ice?.length || o.toppings?.length);
};

/** Chọn món tại quầy. Có `order` = thêm món cho đơn đặt trên app; không có = bán tại quầy.
 *  Cả hai: chọn Tiền mặt / Chuyển khoản rồi Xác nhận ngay trên màn này. */
function CreateOrder({ member, menu, order, busy, onBack, onConfirm, onClearMember }: {
  member: Member | null; menu: MenuItem[]; order?: Order; busy?: boolean; onBack: () => void;
  onConfirm: (lines: OrderLine[], method: "cash" | "transfer") => void; onClearMember?: () => void;
}) {
  const { api } = useStaff();
  const toast = useToast();
  const [cat, setCat] = useState<Category>("Cà phê");
  const [lines, setLines] = useState<OrderLine[]>(order?.items ?? []);
  const [pick, setPick] = useState<MenuItem | null>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  const list = useMemo(() => menu.filter((m) => m.category === cat), [menu, cat]);
  const sum = lines.reduce((s, l) => s + l.lineTotal, 0);
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  // Đơn có ưu đãi: hỏi database tổng sau ưu đãi cho danh sách món hiện tại (chỉ xem trước, chưa lưu)
  const [exact, setExact] = useState<number | null>(null);
  const hasVoucher = !!order?.voucher_title;
  const linesKey = JSON.stringify(lines.map(toInput));
  useEffect(() => {
    if (!order || !hasVoucher || !lines.length) { setExact(null); return; }
    let live = true;
    api.previewOrder(order.id, lines.map(toInput)).then((o) => live && setExact(o.total)).catch(() => live && setExact(null));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey]);
  const total = hasVoucher && exact != null ? exact : sum;

  const add = (l: Omit<OrderLine, "lineTotal">) => {
    setLines((prev) => [...prev, { ...l, lineTotal: l.qty * l.unitPrice }]);
    setPick(null);
  };
  const setQty = (i: number, q: number) =>
    setLines((prev) => (q <= 0 ? prev.filter((_, j) => j !== i) : prev.map((l, j) => (j === i ? { ...l, qty: q, lineTotal: q * l.unitPrice } : l))));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 pb-20 lg:h-full lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-4 lg:pb-0 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col lg:min-h-0">
        <div className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 lg:mx-0 lg:px-0 lg:pb-0">
          <button onClick={onBack} className="h-11 shrink-0 rounded-full bg-paper px-4 text-sm font-bold text-muted">← Quay lại</button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`h-11 shrink-0 whitespace-nowrap rounded-full px-4 font-bold lg:px-5 ${cat === c ? "bg-bean text-cream" : "bg-paper text-bean-dark"}`}>{c}</button>
          ))}
        </div>
        <div className="mt-3 grid auto-rows-min grid-cols-2 gap-2 pb-2 sm:grid-cols-3 lg:min-h-0 lg:flex-1 lg:gap-3 lg:overflow-y-auto xl:grid-cols-4">
          {list.map((m) => (
            <button key={m.id} disabled={!m.available}
              onClick={() => (hasOptions(m) ? setPick(m) : add({ itemId: m.id, name: m.name, image: m.image, qty: 1, unitPrice: m.price, toppings: [] }))}
              className="card flex flex-col items-center p-3 text-center active:scale-[0.97] disabled:opacity-40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(m.image)} alt="" className={`h-16 w-16 rounded-2xl object-cover lg:h-20 lg:w-20 ${m.available ? "" : "grayscale"}`} />
              <div className="mt-2 font-semibold leading-tight text-bean-dark">{m.name}</div>
              <div className="text-sm text-muted">{m.available ? vnd(m.price) : "Hết hàng"}</div>
            </button>
          ))}
        </div>
      </div>
      <div ref={cartRef} className="card flex scroll-mt-28 flex-col p-4 lg:min-h-0">
        {order ? (
          <div className="text-sm text-muted">Thêm món cho đơn {order.ref ?? ""}{member ? ` · •••• ${member.phone.slice(-4)}` : ""}</div>
        ) : member ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-cream-2 px-3 py-2 text-sm">
            <span className="font-semibold text-bean-dark">Tích điểm cho •••• {member.phone.slice(-4)}{member.name ? ` · ${member.name}` : ""}</span>
            {onClearMember && <button onClick={onClearMember} className="font-bold text-muted">Bỏ</button>}
          </div>
        ) : (
          <div className="rounded-2xl bg-cream-2 px-3 py-2 text-sm text-muted">
            <span className="font-semibold text-bean-dark">Khách vãng lai.</span> Khách có app thì quét mã thành viên hoặc nhập SĐT ở trên để tích điểm.
          </div>
        )}
        <ul className="mt-2 divide-y divide-line lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {lines.map((l, i) => (
            <li key={i} className="py-2">
              <LineText line={{ ...l, qty: l.qty }} />
              <div className="mt-1 flex items-center justify-between">
                <div className="flex items-center rounded-full bg-cream-2 p-0.5">
                  <button onClick={() => setQty(i, l.qty - 1)} className="grid h-9 w-9 place-items-center rounded-full bg-paper"><IMinus size={16} /></button>
                  <span className="w-8 text-center font-bold">{l.qty}</span>
                  <button onClick={() => setQty(i, l.qty + 1)} className="grid h-9 w-9 place-items-center rounded-full bg-paper"><IPlus size={16} /></button>
                </div>
                <span className="font-semibold tabular-nums">{vnd(l.lineTotal)}</span>
              </div>
            </li>
          ))}
          {!lines.length && <li className="py-6 text-center text-muted lg:py-10">Chạm vào món để thêm</li>}
        </ul>
        <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
          <span className="font-bold">Tổng</span><span className="text-3xl font-bold tabular-nums">{vnd(total)}</span>
        </div>
        {order && <div className="text-right text-xs text-muted">trước khi thêm: {vnd(order.total)}{hasVoucher ? " · đã gồm ưu đãi" : ""}</div>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["cash", "transfer"] as const).map((m) => (
            <button key={m} onClick={() => setMethod(m)}
              className={`h-12 rounded-2xl border-2 font-bold ${method === m ? "border-bean bg-bean text-cream" : "border-line bg-paper text-bean-dark"}`}>
              {m === "cash" ? "💵 " : "🏦 "}{PAYMENT_LABEL[m]}
            </button>
          ))}
        </div>
        <button disabled={!lines.length || busy} onClick={() => onConfirm(lines, method)}
          className="mt-3 h-16 w-full rounded-3xl bg-done text-lg font-bold text-white shadow-lg active:scale-[0.98] disabled:opacity-60">
          Xác nhận
          <div className="text-xs font-semibold text-white/85">{vnd(total)}{member ? ` · +${pointsFor(total)} điểm` : ""}</div>
        </button>
      </div>
      {/* Điện thoại: thanh tổng tiền dính đáy, chạm để xuống phần thanh toán */}
      {lines.length > 0 && (
        <button onClick={() => cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="fixed inset-x-3 bottom-3 z-20 flex h-14 items-center justify-between rounded-2xl bg-bean px-4 font-bold text-cream shadow-lg lg:hidden">
          <span>{lines.reduce((s, l) => s + l.qty, 0)} món · {vnd(total)}</span>
          <span>Thanh toán ↓</span>
        </button>
      )}
      <OptionPicker item={pick} onClose={() => setPick(null)} onAdd={add} />
    </div>
  );
}

function PointsOnly({ member, onBack, onNext }: { member: Member; onBack: () => void; onNext: () => void }) {
  const { api } = useStaff();
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [m, setM] = useState(member);
  const [done, setDone] = useState<{ points: number; amount: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const n = Number(amount.replace(/\D/g, "")) || 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.addPoints(member.phone, n);
      beep();
      setM(r.member); setDone({ points: r.points, amount: n }); setAmount("");
    } catch (er) { buzz(); toast((er as Error).message); }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pt-2">
      <MemberBadge member={m} big />
      {done ? (
        <div className="animate-pop rounded-3xl bg-done p-6 text-center text-white">
          <div className="text-3xl font-bold">+{done.points} điểm</div>
          <div className="mt-1 text-white/90">Hoá đơn {vnd(done.amount)} · khách hiện có {m.points} điểm</div>
          <button onClick={onNext} className="mt-5 h-14 rounded-2xl bg-white px-8 text-lg font-bold text-done">Khách tiếp theo →</button>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4 p-4 sm:p-6">
          <div className="text-xl font-bold text-bean-dark">Chỉ tích điểm cho hoá đơn tại quầy</div>
          <input autoFocus inputMode="numeric" value={n ? n.toLocaleString("vi-VN") : ""} onChange={(e) => setAmount(e.target.value)}
            placeholder="Số tiền hoá đơn, vd 85.000"
            className="h-16 w-full rounded-2xl border-2 border-line bg-paper px-5 text-3xl font-bold tabular-nums outline-none focus:border-caramel" />
          <div className="flex gap-2">
            {[30000, 50000, 100000, 200000].map((v) => (
              <button type="button" key={v} onClick={() => setAmount(String(v))} className="h-11 flex-1 rounded-xl bg-cream-2 font-bold text-bean">{vnd(v)}</button>
            ))}
          </div>
          <div className="text-lg text-muted">= <b className="text-bean-dark">{pointsFor(n)} điểm</b> (1 điểm / 10.000đ)</div>
          <div className="flex gap-3">
            <button type="button" onClick={onBack} className="h-14 rounded-2xl border-2 border-line px-6 font-bold text-muted">← Quay lại</button>
            <button disabled={busy || pointsFor(n) <= 0} className="btn-primary h-14 flex-1 text-lg">Cộng {pointsFor(n)} điểm</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function TodayList({ hidden, orders, current, onOpen, autoPrint, onToggleAutoPrint }: {
  hidden?: boolean; orders: Order[]; current: string | null; onOpen: (o: Order) => void; autoPrint: boolean; onToggleAutoPrint: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "open">("all");
  const paid = orders.filter((o) => o.paid_at || (o.confirmed_at && o.status !== "cancelled"));
  const revenue = paid.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
  const shown = filter === "open" ? orders.filter((o) => ["pending", "confirmed", "making"].includes(viewStatus(o))) : orders;
  return (
    <aside className={`w-full shrink-0 flex-col bg-paper lg:flex lg:w-[300px] lg:border-l lg:border-line xl:w-[340px] ${hidden ? "hidden" : "flex"}`}>
      <div className="border-b border-line p-4">
        <div className="flex items-baseline justify-between">
          <div className="text-lg font-bold text-bean-dark">Đơn hôm nay</div>
          <div className="text-sm text-muted">{orders.length} đơn</div>
        </div>
        <div className="mt-0.5 text-sm text-muted">Đã thu <b className="text-bean-dark">{vnd(revenue)}</b></div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex rounded-full bg-cream-2 p-0.5 text-xs font-bold">
            {(["all", "open"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 ${filter === f ? "bg-paper text-bean-dark shadow-sm" : "text-muted"}`}>
                {f === "all" ? "Tất cả" : "Chưa xong"}
              </button>
            ))}
          </div>
          <button onClick={onToggleAutoPrint} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-muted">
            <span className={`relative h-5 w-9 rounded-full ${autoPrint ? "bg-done" : "bg-line"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${autoPrint ? "left-4.5" : "left-0.5"}`} />
            </span>
            Tự in tem
          </button>
        </div>
      </div>
      <ul className="space-y-2 p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {shown.map((o) => (
          <li key={o.id}>
            <button onClick={() => onOpen(o)}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left ${current === o.id ? "border-caramel bg-accent-soft/50" : "border-transparent bg-cream"}`}>
              <div className={`w-14 shrink-0 font-bold ${o.code ? "text-xl text-bean-dark" : "text-sm text-muted"}`}>{o.code ? `#${o.code}` : o.ref}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{o.items.map((l) => `${l.qty} ${l.name}`).join(", ")}</div>
                <div className="text-xs text-muted">{o.member_phone ? `•••• ${o.member_phone.slice(-4)}` : "Vãng lai"} · {hhmm(o.confirmed_at ?? o.created_at)} · {vnd(o.total)}</div>
              </div>
              <StatusPill o={o} />
            </button>
          </li>
        ))}
        {!shown.length && <li className="py-10 text-center text-sm text-muted">Chưa có đơn. Đơn khách đặt trên app chỉ hiện ở đây sau khi quầy quét mã.</li>}
      </ul>
    </aside>
  );
}
