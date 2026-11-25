import type { Order, OrderStatus } from "./types";

/** Đơn "Chờ xác nhận" quá thời gian này mà nhân viên chưa quét → hết hạn */
export const ORDER_EXPIRE_MIN = 30;
/** Đơn đã xong vẫn hiện trên màn QR trong khoảng này */
export const DONE_VISIBLE_MIN = 30;

export const ACTIVE: OrderStatus[] = ["pending", "confirmed", "making"];

export type ViewStatus = OrderStatus | "expired";

type StatusFields = Pick<Order, "status" | "created_at" | "cancelled_at" | "cancel_reason">;

export function viewStatus(o: StatusFields, now = Date.now()): ViewStatus {
  if (o.status === "pending" && now - new Date(o.created_at).getTime() > ORDER_EXPIRE_MIN * 60_000) return "expired";
  if (o.status === "cancelled" && o.cancel_reason === "expired") return "expired";
  return o.status;
}

/** Đơn hết hạn / bị huỷ: lúc nào và vì sao — vd "Hết hạn lúc 21:24 25/11" */
export function endedInfo(o: StatusFields, now = Date.now()): { at: string; label: string } | null {
  const vs = viewStatus(o, now);
  if (vs === "expired") {
    const at = o.cancelled_at ?? new Date(new Date(o.created_at).getTime() + ORDER_EXPIRE_MIN * 60_000).toISOString();
    return { at, label: "Hết hạn" };
  }
  if (vs === "cancelled" && o.cancelled_at) {
    return { at: o.cancelled_at, label: o.cancel_reason === "customer" ? "Bạn huỷ" : "Quầy huỷ" };
  }
  return null;
}

export const STATUS_LABEL: Record<ViewStatus, string> = {
  pending: "Chờ đến quầy",
  confirmed: "Đang xếp hàng",
  making: "Đang pha",
  done: "Đã xong",
  cancelled: "Đã huỷ",
  expired: "Hết hạn",
};

/** Mã đơn hiển thị: A01…A99, B01…B99… đánh lại mỗi ngày (khớp private.next_queue_code) */
export function makeOrderCode(countToday: number): string {
  const letters = "ABCDEFGHKLMNPRSTUVXY";
  return letters[Math.floor(countToday / 99) % letters.length] + String((countToday % 99) + 1).padStart(2, "0");
}

/** Các cột đơn dùng ở màn hình nhân viên */
export const STAFF_COLS =
  "id,code,ref,member_phone,items,subtotal,discount,voucher_title,total,status,created_at,confirmed_at,done_at,payment_method,paid_at,source,cancelled_at,cancel_reason,scanned_at";

export const PAYMENT_LABEL = { cash: "Tiền mặt", transfer: "Chuyển khoản" } as const;

/** Thời điểm 00:00 hôm nay theo giờ Việt Nam (UTC+7), dạng ISO */
export function startOfTodayVN(): string {
  const now = new Date();
  const vn = new Date(now.getTime() + 7 * 3600_000);
  vn.setUTCHours(0, 0, 0, 0);
  return new Date(vn.getTime() - 7 * 3600_000).toISOString();
}

/** Tên ngắn của đơn: số thứ tự nếu đã quét tại quầy, ngược lại là mã tạm */
export function orderNo(o: Pick<Order, "code" | "ref">): string {
  return o.code ? `#${o.code}` : `mã ${o.ref ?? "—"}`;
}
