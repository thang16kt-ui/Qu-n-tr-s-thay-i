import type { Voucher } from "@/lib/types";
import { dateShort } from "@/lib/format";

/** Thẻ voucher dạng vé có răng cưa */
export default function VoucherCard({ v, code, expires, action }: {
  v: Voucher; code?: string; expires?: string; action?: React.ReactNode;
}) {
  return (
    <div className="card flex overflow-hidden">
      <div className="relative grid w-24 shrink-0 place-items-center text-center text-cream" style={{ background: v.color || "#C2432A" }}>
        <div className="px-2 text-[0.7rem] font-semibold uppercase leading-tight tracking-wider">
          {v.cost_points > 0 ? <><span className="block text-2xl font-bold">{v.cost_points}</span>điểm</> : <span className="text-sm">Quà tặng</span>}
        </div>
        <div className="absolute -right-2 top-0 flex h-full flex-col justify-around">
          {Array.from({ length: 6 }).map((_, i) => <span key={i} className="h-3 w-3 rounded-full bg-paper" />)}
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1 p-4 pl-5">
        <div className="font-semibold leading-snug text-bean-dark">{v.title}</div>
        {v.description && <div className="text-xs leading-relaxed text-muted">{v.description}</div>}
        {code && <div className="mt-1 text-xs text-bean">Mã: <b className="tracking-widest">{code}</b>{expires && <> · HSD {dateShort(expires)}</>}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
