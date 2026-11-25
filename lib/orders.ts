import type { Order, OrderStatus } from "./types";

/** Đơn "Chờ xác nhận" quá thời gian này mà nhân viên chưa quét → hết hạn */
export const ORDER_EXPIRE_MIN = 30;
/** Đơn đã xong vẫn hiện trên màn QR trong khoảng này */
export const DONE_VISIBLE_MIN = 30;

export const ACTIVE: OrderStatus[] = ["pending", "confirmed", "making"];

export type ViewStatus = OrderStatus | "expired";

export function viewStatus(o: Pick<Order, "status" | "created_at">, now = Date.now()): ViewStatus {
  if (o.status === "pending" && now - new Date(o.created_at).getTime() > ORDER_EXPIRE_MIN * 60_000) return "expired";
  return o.status;
}

export const STATUS_LABEL: Record<ViewStatus, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  making: "Đang pha",
  done: "Đã xong",
  cancelled: "Đã huỷ",
  expired: "Hết hạn",
};

/** Mã đơn hiển thị: A1…A99, B1…B99… đánh lại mỗi ngày */
export function makeOrderCode(countToday: number): string {
  const letters = "ABCDEFGH";
  return letters[Math.floor(countToday / 99) % letters.length] + ((countToday % 99) + 1);
}

/** Thời điểm 00:00 hôm nay theo giờ Việt Nam (UTC+7), dạng ISO */
export function startOfTodayVN(): string {
  const now = new Date();
  const vn = new Date(now.getTime() + 7 * 3600_000);
  vn.setUTCHours(0, 0, 0, 0);
  return new Date(vn.getTime() - 7 * 3600_000).toISOString();
}
