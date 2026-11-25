import { sbAdmin, json, fail } from "@/lib/supabase-admin";
import { normalizePhone } from "@/lib/format";

/** Đăng nhập = tạo thành viên nếu chưa có */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  if (!phone) return fail("Số điện thoại không hợp lệ");
  const db = sbAdmin();

  const { data: existing } = await db.from("members").select("*").eq("phone", phone).maybeSingle();
  if (existing) return json({ member: existing, isNew: false });

  const { data: member, error } = await db.from("members").insert({ phone }).select().single();
  if (error) return fail(error.message, 500);

  // Quà chào mừng
  const { data: welcome } = await db.from("vouchers").select("id, valid_days").eq("id", "welcome-10").maybeSingle();
  if (welcome) {
    await db.from("member_vouchers").insert({
      member_phone: phone, voucher_id: welcome.id,
      expires_at: new Date(Date.now() + welcome.valid_days * 86400_000).toISOString(),
    });
  }
  return json({ member, isNew: true });
}

/** Đổi tên hiển thị */
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  if (!phone) return fail("Số điện thoại không hợp lệ");
  const name = String(body.name || "").trim().slice(0, 40) || null;
  const { data, error } = await sbAdmin().from("members").update({ name }).eq("phone", phone).select().single();
  if (error) return fail(error.message, 500);
  return json({ member: data });
}
