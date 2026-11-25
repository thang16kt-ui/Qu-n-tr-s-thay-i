import { sbAdmin, json, fail } from "@/lib/supabase-admin";
import { normalizePhone } from "@/lib/format";
import { sanitizeSelection, unitPrice } from "@/lib/pricing";
import { ACTIVE, makeOrderCode, startOfTodayVN } from "@/lib/orders";
import { expireStaleOrders } from "@/lib/server-orders";
import type { MenuItem, OrderLine } from "@/lib/types";

type InLine = { itemId: string; qty: number; size?: string; sugar?: string; ice?: string; toppings?: string[]; note?: string };

/** Khách đặt món (thanh toán tại quầy) */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  if (!phone) return fail("Vui lòng đăng nhập lại");
  const lines: InLine[] = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  if (!lines.length) return fail("Giỏ hàng đang trống");

  const db = sbAdmin();
  const { data: member } = await db.from("members").select("phone").eq("phone", phone).maybeSingle();
  if (!member) return fail("Không tìm thấy thành viên, vui lòng đăng nhập lại", 401);

  await expireStaleOrders();

  // Mỗi thành viên chỉ có 1 đơn đang chờ — vì chỉ có MỘT mã QR
  const { data: active } = await db.from("orders").select("code").eq("member_phone", phone)
    .in("status", ACTIVE).limit(1).maybeSingle();
  if (active) return fail(`Bạn đang có đơn #${active.code} chưa xong. Đưa mã QR cho nhân viên hoặc chờ đơn xong nhé.`, 409);

  // Tính lại giá từ database (không tin giá gửi lên)
  const ids = [...new Set(lines.map((l) => l.itemId))];
  const { data: menu } = await db.from("menu_items").select("*").in("id", ids);
  const byId = new Map((menu as MenuItem[] | null ?? []).map((m) => [m.id, m]));

  const items: OrderLine[] = [];
  for (const l of lines) {
    const m = byId.get(l.itemId);
    if (!m) return fail("Có món không còn trong thực đơn");
    if (!m.available) return fail(`${m.name} vừa hết hàng, vui lòng bỏ khỏi giỏ`);
    const qty = Math.max(1, Math.min(20, Math.floor(Number(l.qty) || 1)));
    const sel = sanitizeSelection(m, { ...l, toppings: Array.isArray(l.toppings) ? l.toppings : [] });
    const price = unitPrice(m, sel);
    items.push({ itemId: m.id, name: m.name, image: m.image, qty, unitPrice: price, lineTotal: price * qty, ...sel });
  }
  const total = items.reduce((s, l) => s + l.lineTotal, 0);

  // Số đơn trong ngày → A1, A2…
  const { count } = await db.from("orders").select("id", { count: "exact", head: true }).gte("created_at", startOfTodayVN());
  const code = makeOrderCode(count ?? 0);

  const sub = body.push_subscription && typeof body.push_subscription === "object" && body.push_subscription.endpoint
    ? body.push_subscription : null;

  const { data: order, error } = await db.from("orders").insert({
    code, member_phone: phone, items, total, status: "pending", push_subscription: sub,
  }).select("id,code,member_phone,items,total,status,created_at,confirmed_at,done_at").single();
  if (error) return fail(error.message, 500);
  return json({ order });
}
