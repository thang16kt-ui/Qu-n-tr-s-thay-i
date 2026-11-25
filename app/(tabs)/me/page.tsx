"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { tierInfo, TIERS } from "@/lib/tiers";
import { dateTime, prettyPhone } from "@/lib/format";
import type { PointLog } from "@/lib/types";
import PushCard from "@/components/PushCard";
import InstallGuide from "@/components/InstallGuide";
import { IEdit, ILogout, IChevron } from "@/components/Icons";
import { useToast } from "@/components/Toast";


export default function MePage() {
  const { phone, member, logout, refresh } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [logs, setLogs] = useState<PointLog[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    if (!phone) return;
    sb().from("point_log").select("*").eq("member_phone", phone).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setLogs((data ?? []) as PointLog[]));
  }, [phone, member?.points]);

  async function saveName() {
    try {
      await api.setName(phone!, name);
      await refresh(); setEditing(false); toast("Đã lưu tên");
    } catch (e) { toast((e as Error).message); }
  }

  const tier = tierInfo(member?.tier ?? "Mầm");

  return (
    <div className="px-5 pt-safe">
      <h1 className="pt-5 text-2xl font-bold text-bean-dark">Cá nhân</h1>

      <div className="card mt-4 p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full text-2xl font-bold text-cream"
            style={{ background: `linear-gradient(135deg, ${tier.from}, ${tier.to})` }}>
            {(member?.name || "M").trim().charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="flex gap-2">
                <input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Tên của bạn"
                  className="h-10 w-full rounded-xl border-2 border-line bg-paper px-3 outline-none focus:border-caramel" />
                <button onClick={saveName} className="btn-primary px-4 text-sm">Lưu</button>
              </div>
            ) : (
              <button onClick={() => { setName(member?.name || ""); setEditing(true); }} className="flex items-center gap-2 text-left">
                <span className="text-lg font-bold text-bean-dark">{member?.name || "Thêm tên của bạn"}</span>
                <IEdit size={16} className="text-muted" />
              </button>
            )}
            <div className="text-sm text-muted">Mã thành viên: {phone && prettyPhone(phone)}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-cream p-3"><div className="text-xs text-muted">Hạng</div><div className="font-bold text-bean-dark">{tier.name}</div></div>
          <div className="rounded-2xl bg-cream p-3"><div className="text-xs text-muted">Điểm</div><div className="font-bold text-bean-dark">{member?.points ?? 0}</div></div>
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold text-caramel">Quyền lợi các hạng</summary>
          <ul className="mt-2 space-y-1.5 text-muted">
            {TIERS.map((t) => <li key={t.name}><b className="text-bean-dark">{t.name}</b> (từ {t.min} điểm tích luỹ): {t.perk}</li>)}
          </ul>
        </details>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Lịch sử điểm</h2>
        <Link href="/orders/" className="text-sm font-semibold text-caramel">Xem đơn hàng</Link>
      </div>
      <div className="card mt-2 px-4 py-1">
        <ul className="divide-y divide-line">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-3">
              <span>
                <span className="block text-sm font-medium text-bean-dark">{l.note || "Tích điểm"}</span>
                <span className="block text-xs text-muted">{dateTime(l.created_at)}</span>
              </span>
              <span className={`font-bold ${l.points >= 0 ? "text-done" : "text-danger"}`}>{l.points >= 0 ? "+" : ""}{l.points}</span>
            </li>
          ))}
          {logs.length === 0 && <li className="py-8 text-center text-sm text-muted">Chưa có lịch sử điểm.</li>}
        </ul>
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wider text-muted">Cài đặt</h2>
      <div className="mt-2 space-y-3">
        <PushCard />
        <button onClick={() => setGuide(true)} className="card flex w-full items-center justify-between p-4 text-left">
          <span className="font-medium text-bean-dark">Thêm Mộc vào màn hình chính</span><IChevron className="text-muted" />
        </button>
        <button onClick={() => { logout(); router.replace("/login"); }} className="card flex w-full items-center gap-3 p-4 text-left font-medium text-danger">
          <ILogout size={20} /> Đăng xuất
        </button>
      </div>
      <Link href="/pos" className="mt-6 block text-center text-xs text-muted underline">Dành cho nhân viên</Link>
      <InstallGuide open={guide} onClose={() => setGuide(false)} />
    </div>
  );
}
