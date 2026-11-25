import { sbAdmin, json, fail, staffOk } from "@/lib/supabase-admin";

/** Bật / tắt "hết hàng" — khách thấy ngay nhờ realtime */
export async function POST(req: Request) {
  if (!staffOk(req)) return fail("Sai mã PIN nhân viên", 401);
  const body = await req.json().catch(() => ({}));
  if (!body.id) return fail("Thiếu mã món");
  const { data, error } = await sbAdmin().from("menu_items").update({ available: !!body.available }).eq("id", String(body.id)).select().single();
  if (error) return fail(error.message, 500);
  return json({ item: data });
}

/** Kiểm tra PIN */
export async function GET(req: Request) {
  return staffOk(req) ? json({ ok: true }) : fail("Sai mã PIN nhân viên", 401);
}
