import { sbAdmin, json, fail, staffOk } from "@/lib/supabase-admin";
import { normalizePhone, vnd } from "@/lib/format";
import { pointsFor } from "@/lib/tiers";

/** Tích điểm cho hoá đơn mua tại quầy (mã QR chỉ có SĐT) */
export async function POST(req: Request) {
  if (!staffOk(req)) return fail("Sai mã PIN nhân viên", 401);
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const amount = Math.floor(Number(body.amount) || 0);
  if (!phone) return fail("SĐT không hợp lệ");
  if (amount <= 0 || amount > 10_000_000) return fail("Số tiền không hợp lệ");
  const points = pointsFor(amount);
  if (points <= 0) return fail("Hoá đơn dưới 10.000đ chưa được tích điểm");

  const db = sbAdmin();
  await db.from("members").upsert({ phone }, { onConflict: "phone", ignoreDuplicates: true });
  const { data, error } = await db.rpc("add_points", {
    p_phone: phone, p_order: null, p_points: points, p_note: `Hoá đơn tại quầy ${vnd(amount)}`,
  });
  if (error) return fail(error.message, 500);
  return json({ member: data, points });
}
