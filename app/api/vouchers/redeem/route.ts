import { sbAdmin, json, fail } from "@/lib/supabase-admin";
import { normalizePhone } from "@/lib/format";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  if (!phone || !body.voucherId) return fail("Thiếu thông tin");
  const { data, error } = await sbAdmin().rpc("redeem_voucher", { p_phone: phone, p_voucher: String(body.voucherId) });
  if (error) return fail(error.message);
  return json({ voucher: data });
}
