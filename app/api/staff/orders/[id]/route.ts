import { sbAdmin, json, fail, staffOk } from "@/lib/supabase-admin";
import { pushOrderDone } from "@/lib/push-server";
import { pointsFor } from "@/lib/tiers";
import type { OrderStatus } from "@/lib/types";

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "making", "done", "cancelled"],
  confirmed: ["making", "done", "cancelled"],
  making: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

/** Nhân viên đổi trạng thái đơn: xác nhận (cộng điểm) → đang pha → đã xong (gửi push) / huỷ */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!staffOk(req)) return fail("Sai mã PIN nhân viên", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status as OrderStatus;

  const db = sbAdmin();
  const { data: order } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) return fail("Không tìm thấy đơn", 404);
  if (!NEXT[order.status as OrderStatus]?.includes(status)) {
    return fail(`Không thể chuyển đơn từ “${order.status}” sang “${status}”`);
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status !== "cancelled" && !order.confirmed_at) patch.confirmed_at = now;
  if (status === "done") patch.done_at = now;

  // Chỉ cập nhật nếu trạng thái chưa bị người khác đổi (tránh bấm 2 lần)
  const { data: updated, error } = await db.from("orders").update(patch).eq("id", id).eq("status", order.status).select().maybeSingle();
  if (error) return fail(error.message, 500);
  if (!updated) return fail("Đơn vừa được cập nhật ở máy khác, hãy tải lại", 409);

  // Lần đầu xác nhận → tích điểm cho khách
  let points = 0;
  if (patch.confirmed_at) {
    const { count } = await db.from("point_log").select("id", { count: "exact", head: true }).eq("order_id", id);
    if (!count) {
      points = pointsFor(order.total);
      if (points > 0) {
        const { error: e2 } = await db.rpc("add_points", {
          p_phone: order.member_phone, p_order: id, p_points: points, p_note: `Đơn #${order.code}`,
        });
        if (e2) console.error("Cộng điểm lỗi:", e2.message);
      }
    }
  }

  let pushed = false;
  if (status === "done") pushed = await pushOrderDone(updated);

  const { push_subscription, ...safe } = updated;
  return json({ order: safe, points, pushed, hadSubscription: !!push_subscription });
}
