import { sbAdmin, json, fail, staffOk } from "@/lib/supabase-admin";
import { parseQR } from "@/lib/qr";
import { expireStaleOrders } from "@/lib/server-orders";

const COLS = "id,code,member_phone,items,total,status,created_at,confirmed_at,done_at";

/** Nhân viên quét mã QR của khách */
export async function POST(req: Request) {
  if (!staffOk(req)) return fail("Sai mã PIN nhân viên", 401);
  const body = await req.json().catch(() => ({}));
  const parsed = parseQR(String(body.qr || ""));
  if (!parsed.ok) return fail(parsed.error);

  const db = sbAdmin();
  await expireStaleOrders();

  let { data: member } = await db.from("members").select("*").eq("phone", parsed.phone).maybeSingle();
  if (!member) {
    const ins = await db.from("members").insert({ phone: parsed.phone }).select().single();
    member = ins.data;
  }

  let order = null;
  if (parsed.orderCode) {
    const { data } = await db.from("orders").select(COLS).eq("member_phone", parsed.phone).eq("code", parsed.orderCode)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    order = data;
  }
  return json({ member, order, orderCode: parsed.orderCode });
}
