"use client";
import { useEffect, useState } from "react";
import { enablePush, pushState, type PushState } from "@/lib/push";
import { IBell } from "./Icons";
import InstallGuide from "./InstallGuide";
import { useToast } from "./Toast";

/** Thẻ xin quyền Web Push. onSubscribed nhận subscription để gắn vào đơn đang chờ. */
export default function PushCard({ onSubscribed, compact }: { onSubscribed?: (s: PushSubscriptionJSON) => void; compact?: boolean }) {
  const [state, setState] = useState<PushState>("unsupported");
  const [guide, setGuide] = useState(false);
  const toast = useToast();
  useEffect(() => { setState(pushState()); }, []);

  async function enable() {
    const sub = await enablePush().catch(() => null);
    setState(pushState());
    if (sub) { toast("Đã bật thông báo 🔔"); onSubscribed?.(sub); }
    else if (pushState() === "denied") toast("Bạn đã chặn thông báo trong cài đặt trình duyệt");
  }

  if (state === "granted") {
    return compact ? null : (
      <div className="flex items-center gap-2 rounded-2xl bg-done/12 px-4 py-3 text-sm text-done">
        <IBell size={18} /> Mộc sẽ gửi thông báo khi đơn xong.
      </div>
    );
  }

  const box = "flex items-center gap-3 rounded-2xl border border-line bg-paper p-3.5";
  if (state === "default") {
    return (
      <div className={box}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-caramel/15 text-caramel"><IBell size={20} /></span>
        <span className="flex-1 text-sm leading-snug">Nhận thông báo khi đơn pha xong</span>
        <button onClick={enable} className="btn-primary px-4 py-2 text-sm">Bật</button>
      </div>
    );
  }
  if (state === "ios-needs-install") {
    return (
      <>
        <div className={box}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-caramel/15 text-caramel"><IBell size={20} /></span>
          <span className="flex-1 text-sm leading-snug">Trên iPhone, thêm Mộc vào màn hình chính để nhận thông báo.</span>
          <button onClick={() => setGuide(true)} className="btn-primary px-4 py-2 text-sm">Xem cách</button>
        </div>
        <InstallGuide open={guide} onClose={() => setGuide(false)} />
      </>
    );
  }
  // unsupported / denied / no-key
  return (
    <div className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm leading-snug text-muted">
      {state === "denied" ? "Thông báo đang bị chặn. " : "Máy này chưa nhận được thông báo đẩy. "}
      Cứ để màn hình này mở — khi đơn xong, mã sẽ <b className="text-done">chuyển xanh</b> và <b>kêu “ting ting”</b>.
    </div>
  );
}
