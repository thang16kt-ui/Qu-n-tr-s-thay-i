import { sbAdmin, json, fail } from "@/lib/supabase-admin";
import { normalizePhone } from "@/lib/format";

/** Gắn Web Push subscription vào đơn (khi khách bật thông báo sau khi đã đặt) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const sub = body.subscription;
  if (!phone || !sub?.endpoint) return fail("Thiếu thông tin");
  const { error } = await sbAdmin().from("orders").update({ push_subscription: sub })
    .eq("id", id).eq("member_phone", phone).in("status", ["pending", "confirmed", "making"]);
  if (error) return fail(error.message, 500);
  return json({ ok: true });
}
