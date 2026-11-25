"use client";
import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { nextTier, tierInfo } from "@/lib/tiers";
import { prettyPhone } from "@/lib/format";
import { IQR } from "./Icons";
import MemberQRSheet from "./MemberQRSheet";

export default function MemberCard() {
  const { member, phone } = useSession();
  const [earned, setEarned] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    if (!phone) return;
    sb().from("point_log").select("points").eq("member_phone", phone).gt("points", 0)
      .then(({ data }) => setEarned((data ?? []).reduce((s, r: { points: number }) => s + r.points, 0)));
  }, [phone, member?.points]);

  const tier = tierInfo(member?.tier ?? "Mầm");
  const nt = nextTier(earned);

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#34a06a] to-caramel p-5 text-white shadow-[0_22px_44px_-22px_rgba(24,90,52,0.7)]">
      {/* vân gỗ */}
      <svg className="pointer-events-none absolute -right-16 -top-20 opacity-[0.18]" width="260" height="260" viewBox="0 0 260 260" aria-hidden>
        {[28, 52, 76, 100, 124].map((r, i) => (
          <ellipse key={r} cx={140 - i * 3} cy={130 + i * 2} rx={r} ry={r * 0.78} fill="none" stroke="#DFF3E5" strokeWidth="2.5" />
        ))}
      </svg>

      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${tier.from}, ${tier.to})`, boxShadow: "0 0 0 2px rgba(255,255,255,0.35)" }} />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#dff3e5]">Hạng {tier.name}</span>
          </div>
          <div className="mt-2 text-lg font-bold">{member?.name || "Bạn của Mộc"}</div>
          <div className="text-sm text-white/75">{phone && prettyPhone(phone)}</div>
        </div>
        <button onClick={() => setQrOpen(true)} className="flex items-center gap-1.5 rounded-full bg-paper px-3.5 py-2 text-sm font-semibold text-bean-dark active:scale-95">
          <IQR size={18} /> Mã thành viên
        </button>
      </div>

      <div className="relative mt-6 flex items-end justify-between">
        <div>
          <div className="text-xs text-white/75">Điểm hiện có</div>
          <div className="mt-1 text-[2.6rem] font-bold leading-none tracking-tight">
            {member?.points ?? 0}<span className="ml-1.5 text-base font-medium text-white/75">điểm</span>
          </div>
        </div>
        <div className="text-right text-xs text-white/70">10.000đ = 1 điểm</div>
      </div>

      <div className="relative mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-mustard" style={{ width: `${Math.max(4, nt.progress * 100)}%` }} />
        </div>
        <div className="mt-2 text-xs text-white/85">
          {nt.next ? <>Thêm <b className="text-white">{nt.remaining} điểm</b> để lên hạng <b className="text-white">{nt.next.name}</b></> : <>Bạn đang ở hạng cao nhất</>}
        </div>
      </div>
      <MemberQRSheet open={qrOpen} onClose={() => setQrOpen(false)} />
    </div>
  );
}
