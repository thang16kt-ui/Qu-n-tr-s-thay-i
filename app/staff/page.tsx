"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StaffGate, { useStaff } from "@/components/staff/StaffGate";
import { LineText } from "@/components/staff/parts";
import { useToast } from "@/components/Toast";
import { STAFF_COLS } from "@/lib/orders";
import { audioReady, bell, unlockAudio } from "@/lib/sound";
import { sb } from "@/lib/supabase";
import type { Order } from "@/lib/types";

const LATE_MS = 5 * 60_000;       // chờ quá 5 phút → cam
const DONE_SHOW_MS = 10 * 60_000; // đơn xong tự ẩn sau 10 phút
const UNDO_MS = 10_000;           // "Hoàn tác" trong 10 giây

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function CnPage() {
  return (
    <StaffGate page="cn" title="Cn" right={<Link href="/me" className="text-xs font-bold text-muted underline">← Về app</Link>}>
      <Kitchen />
    </StaffGate>
  );
}

function Kitchen() {
  const { api } = useStaff();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [fresh, setFresh] = useState<Record<string, true>>({});
  const [undo, setUndo] = useState<Record<string, number>>({}); // id → hạn hoàn tác
  const [sound, setSound] = useState(true);
  const known = useRef<Set<string>>(new Set());
  const pending = useRef<Map<string, { order: Order; timer: number }>>(new Map());

  const upsert = useCallback((o: Order) => {
    setOrders((prev) => {
      const rest = prev.filter((x) => x.id !== o.id);
      return ["confirmed", "making", "done"].includes(o.status) ? [...rest, { ...(prev.find((x) => x.id === o.id) ?? {}), ...o } as Order] : rest;
    });
  }, []);

  // Tải đơn + realtime
  useEffect(() => {
    const load = () =>
      sb().from("orders").select(STAFF_COLS).in("status", ["confirmed", "making", "done"])
        .gte("confirmed_at", new Date(Date.now() - 12 * 3600_000).toISOString())
        .order("confirmed_at", { ascending: true }).limit(200)
        .then(({ data }) => {
          const list = (data ?? []) as Order[];
          list.forEach((o) => known.current.add(o.id));
          setOrders(list);
        });
    load();
    const ch = sb().channel("kitchen-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) => {
        if (p.eventType === "DELETE") {
          const id = (p.old as { id?: string }).id;
          setOrders((prev) => prev.filter((o) => o.id !== id));
          return;
        }
        const o = p.new as Order;
        if (!o?.id) return;
        if ((o.status === "confirmed" || o.status === "making") && !known.current.has(o.id)) {
          known.current.add(o.id);
          bell();
          setFresh((f) => ({ ...f, [o.id]: true }));
          setTimeout(() => setFresh((f) => { const n = { ...f }; delete n[o.id]; return n; }), 30_000);
        }
        upsert(o);
      })
      .subscribe();
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { sb().removeChannel(ch); document.removeEventListener("visibilitychange", onVis); clearInterval(t); };
  }, [upsert]);

  // Âm thanh cần 1 lần chạm vào trang
  useEffect(() => {
    const check = () => setSound(audioReady());
    check();
    window.addEventListener("pointerdown", check);
    const t = setInterval(check, 3000);
    return () => { window.removeEventListener("pointerdown", check); clearInterval(t); };
  }, []);

  // Sau 10 giây không hoàn tác: lưu "Đã xong" + gửi Web Push cho khách
  const commit = useCallback(async (o: Order) => {
    pending.current.delete(o.id);
    try {
      const r = await api.setStatus(o.id, "done");
      upsert(r.order);
      const n = await api.notify(o.id);
      toast(n.sent ? `#${o.code}: đã báo khách ra quầy nhận` : `#${o.code} đã xong · ${n.reason ?? "chưa gửi được thông báo"}`);
    } catch (e) {
      toast((e as Error).message);
    }
    setUndo((u) => { const n = { ...u }; delete n[o.id]; return n; });
  }, [api, toast, upsert]);

  // Rời trang khi còn đơn đang chờ hoàn tác → lưu luôn
  useEffect(() => {
    const flush = () => pending.current.forEach(({ order, timer }) => { clearTimeout(timer); commit(order); });
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [commit]);

  function markDone(o: Order) {
    if (pending.current.has(o.id)) return;
    const timer = window.setTimeout(() => commit(o), UNDO_MS);
    pending.current.set(o.id, { order: o, timer });
    setUndo((u) => ({ ...u, [o.id]: Date.now() + UNDO_MS }));
  }

  function undoDone(id: string) {
    const p = pending.current.get(id);
    if (p) clearTimeout(p.timer);
    pending.current.delete(id);
    setUndo((u) => { const n = { ...u }; delete n[id]; return n; });
  }


  const queue = useMemo(() => orders
    .filter((o) => (o.status === "confirmed" || o.status === "making") && !undo[o.id])
    .sort((a, b) => (a.confirmed_at ?? "").localeCompare(b.confirmed_at ?? "")), [orders, undo]);

  const done = useMemo(() => orders
    .filter((o) => undo[o.id] || (o.status === "done" && o.done_at && now - new Date(o.done_at).getTime() < DONE_SHOW_MS))
    .sort((a, b) => (undo[b.id] ?? new Date(b.done_at ?? 0).getTime()) - (undo[a.id] ?? new Date(a.done_at ?? 0).getTime())), [orders, undo, now]);

  return (
    <div className="flex flex-col lg:h-full lg:flex-row">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 px-3 pb-1 pt-3 lg:flex-nowrap lg:gap-4 lg:px-5 lg:pt-4">
          <h1 className="text-2xl font-bold text-bean-dark">Chờ đủ món</h1>
          <span className="rounded-full bg-paper px-3 py-1 text-sm font-bold text-bean-dark">{queue.length} đơn</span>
          <span className="hidden text-sm text-muted lg:inline">Đơn cũ nhất bên trái</span>
          {!sound && (
            <button onClick={() => { unlockAudio(); bell(); setSound(true); }}
              className="w-full animate-pulse whitespace-nowrap rounded-full bg-mustard px-4 py-2 text-sm font-bold text-mustard-ink lg:ml-auto lg:w-auto">🔔 Chạm để bật âm báo</button>
          )}
        </div>
        <div className="flex flex-col gap-3 p-3 pt-2 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-4 lg:overflow-x-auto lg:p-5 lg:pt-3">
          {queue.map((o) => {
            const wait = now - new Date(o.confirmed_at ?? o.created_at).getTime();
            const late = wait > LATE_MS;
            return (
              <article key={o.id}
                className={`card flex w-full shrink-0 flex-col overflow-hidden lg:h-full lg:w-[300px] ${fresh[o.id] ? "ring-4 ring-mustard" : ""}`}>
                <header className={`flex items-center justify-between px-4 py-3 ${late ? "bg-[#E8780F] text-white" : "bg-bean text-cream"}`}>
                  <div>
                    <div className="text-5xl font-bold leading-none tracking-tight">#{o.code}</div>
                    <div className="mt-1 text-xs font-semibold opacity-80">{o.member_phone ? `•••• ${o.member_phone.slice(-4)}` : "Khách tại quầy"}{fresh[o.id] ? " · MỚI" : ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold tabular-nums">{mmss(wait)}</div>
                    <div className="mt-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                      {late ? "CHỜ LÂU" : "CHỜ ĐỦ MÓN"}
                    </div>
                  </div>
                </header>
                <ul className="space-y-4 p-4 text-bean-dark lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                  {o.items.map((l, i) => <li key={i}><LineText line={l} large /></li>)}
                </ul>
                <div className="space-y-2 border-t border-line p-3">
                  <button onClick={() => markDone(o)}
                    className="h-20 w-full rounded-2xl bg-done text-2xl font-bold text-white shadow-lg active:scale-[0.98]">
                    ✓ Đủ món · Gọi khách
                  </button>
                </div>
              </article>
            );
          })}
          {!queue.length && (
            <div className="grid flex-1 place-items-center py-10 text-center lg:py-0">
              <div>
                <div className="text-6xl">☕</div>
                <div className="mt-4 text-2xl font-bold text-bean-dark">Chưa có đơn</div>
                <div className="mt-1 text-muted">Đơn hiện ngay khi thu ngân bấm “Xác nhận”. Nhận đủ món thì bấm “Gọi khách”.</div>
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="flex w-full shrink-0 flex-col border-t border-line bg-paper lg:w-[290px] lg:border-l lg:border-t-0">
        <div className="border-b border-line px-4 py-4">
          <div className="text-xl font-bold text-done">Đã gọi khách</div>
          <div className="text-xs text-muted">Tự ẩn sau 10 phút</div>
        </div>
        <ul className="space-y-3 p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {done.map((o) => {
            const left = undo[o.id] ? undo[o.id] - now : 0;
            return (
              <li key={o.id} className={`rounded-2xl p-3 ${left > 0 || undo[o.id] ? "bg-mustard/25" : "bg-done/10"}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold text-bean-dark">#{o.code}</span>
                  <span className="text-xs text-muted">
                    {undo[o.id] ? "đang lưu…" : `xong ${new Date(o.done_at!).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`}
                  </span>
                </div>
                <div className="truncate text-sm text-muted">{o.items.map((l) => `${l.qty} ${l.name}`).join(", ")}</div>
                {undo[o.id] && (
                  <>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                      <div className="h-full bg-mustard transition-all" style={{ width: `${Math.max(0, (left / UNDO_MS) * 100)}%` }} />
                    </div>
                    <button onClick={() => undoDone(o.id)} className="mt-2 h-12 w-full rounded-xl bg-bean font-bold text-cream">
                      ↩ Hoàn tác ({Math.max(0, Math.ceil(left / 1000))}s)
                    </button>
                    <div className="mt-1 text-center text-xs text-muted">Báo khách sau khi hết giờ hoàn tác</div>
                  </>
                )}
              </li>
            );
          })}
          {!done.length && <li className="py-10 text-center text-sm text-muted">—</li>}
        </ul>
      </aside>
    </div>
  );
}
