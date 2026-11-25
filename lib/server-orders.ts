import "server-only";
import { sbAdmin } from "./supabase-admin";
import { ORDER_EXPIRE_MIN } from "./orders";

/** Huỷ các đơn "Chờ xác nhận" quá hạn (chạy mỗi khi tạo đơn / quét mã) */
export async function expireStaleOrders() {
  const cutoff = new Date(Date.now() - ORDER_EXPIRE_MIN * 60_000).toISOString();
  await sbAdmin().from("orders").update({ status: "cancelled" }).eq("status", "pending").lt("created_at", cutoff);
}
