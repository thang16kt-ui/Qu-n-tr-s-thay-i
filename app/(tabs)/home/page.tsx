"use client";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { useMyOrders } from "@/lib/my-orders";
import { useMyVouchers } from "@/lib/vouchers";
import { ACTIVE, STATUS_LABEL, viewStatus } from "@/lib/orders";
import { PROMOS } from "@/lib/promos";
import { asset } from "@/lib/api";
import MemberCard from "@/components/MemberCard";
import NotificationBell from "@/components/NotificationBell";
import VoucherCard from "@/components/VoucherCard";
import Logo from "@/components/Logo";
import { IChevron, IQR } from "@/components/Icons";

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Chào buổi sáng";
  if (h < 14) return "Chào buổi trưa";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

export default function HomePage() {
  const { member, phone } = useSession();
  const { orders } = useMyOrders();
  const { list: vouchers } = useMyVouchers(phone);
  const latest = orders[0];
  const activeOrder = latest && ACTIVE.includes(latest.status) && viewStatus(latest) !== "expired" ? latest : null;

  return (
    <div className="px-5 pt-safe">
      <header className="flex items-center justify-between pt-5">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <div className="text-sm text-muted">{greeting()},</div>
            <div className="text-lg font-bold text-bean-dark">{member?.name || "bạn của Mộc"} 👋</div>
          </div>
        </div>
        <NotificationBell />
      </header>

      <section className="mt-5"><MemberCard /></section>

      {activeOrder && (
        <Link href={`/orders/?id=${activeOrder.id}`} className="mt-4 flex items-center gap-3 rounded-3xl bg-accent-soft p-4">
          <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-caramel text-paper">
            <IQR size={22} />
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-accent-soft bg-bean" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold text-bean-dark">Đơn #{activeOrder.code} · {STATUS_LABEL[viewStatus(activeOrder)]}</span>
            <span className="block text-sm text-bean/70">Chạm để mở mã cho nhân viên quét</span>
          </span>
          <IChevron className="text-caramel" />
        </Link>
      )}

      {!activeOrder && (
        <Link href="/order" className="card relative mt-4 flex items-center overflow-hidden p-4 pr-28">
          <span>
            <span className="block text-[0.7rem] font-bold uppercase tracking-[0.18em] text-caramel">Đặt trước</span>
            <span className="mt-1 block text-lg font-bold leading-snug text-bean-dark">Đến quầy là có món</span>
            <span className="mt-0.5 block text-sm text-muted">Chọn món trên app, đưa mã QR khi tới.</span>
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-bean px-4 py-2 text-sm font-semibold text-paper">
              Đặt món <IChevron size={16} />
            </span>
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset("/menu/ca-phe-sua-da.svg")} alt="" className="absolute -bottom-4 -right-6 h-36 w-36 rounded-full" />
        </Link>
      )}

      <section className="mt-7">
        <h2 className="text-lg font-bold text-bean-dark">Chương trình nổi bật</h2>
        <div className="no-scrollbar -mx-5 mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
          {PROMOS.map((p) => (
            <Link key={p.id} href={p.href} className="relative flex h-40 w-[78%] shrink-0 snap-start overflow-hidden rounded-3xl p-4"
              style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}>
              <div className="relative z-10 w-[62%]">
                <span className="rounded-full bg-paper/80 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-caramel">{p.tag}</span>
                <div className="mt-2 text-lg font-bold leading-tight text-bean-dark">{p.title}</div>
                <div className="mt-1 text-xs leading-snug text-bean-dark/75">{p.body}</div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(p.image)} alt="" className="absolute -bottom-3 -right-4 h-36 w-36 rounded-full" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-bean-dark">Ưu đãi của tôi</h2>
          <Link href="/offers" className="text-sm font-semibold text-caramel">Xem tất cả</Link>
        </div>
        <div className="mt-3 space-y-3">
          {vouchers.slice(0, 2).map((mv) => mv.vouchers && (
            <VoucherCard key={mv.id} v={mv.vouchers} code={mv.code} expires={mv.expires_at} />
          ))}
          {vouchers.length === 0 && (
            <Link href="/offers" className="card block p-5 text-center text-sm text-muted">
              Bạn chưa có ưu đãi nào. <span className="font-semibold text-caramel">Dùng điểm để đổi ngay →</span>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
