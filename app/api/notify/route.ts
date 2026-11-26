// Gửi Web Push "Đơn #A12 đã xong, mời bạn ra quầy nhận" tới điện thoại khách.
// Gọi từ màn hình Cn khi bấm "Đủ món · Gọi khách" (đơn chuyển "Đã xong"). Chạy trên máy chủ Vercel (Node.js),
// dùng khoá VAPID trong biến môi trường — khoá bí mật không bao giờ tới trình duyệt.
import { createECDH } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sendNotification } from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function vapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  let subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@example.com";
  if (!/^(mailto:|https:)/.test(subject)) subject = `mailto:${subject}`;
  return publicKey && privateKey ? { publicKey, privateKey, subject } : null;
}

/** Khoá bí mật có đúng là cặp của khoá công khai không */
function paired(v: NonNullable<ReturnType<typeof vapid>>) {
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(v.privateKey, "base64url"));
    return ecdh.getPublicKey().toString("base64url") === v.publicKey.replace(/=+$/, "");
  } catch {
    return false;
  }
}

/** Trang /admin dùng để kiểm tra cấu hình */
export async function GET() {
  const v = vapid();
  return Response.json({ configured: !!v, paired: v ? paired(v) : false, publicKey: v?.publicKey ?? null });
}

export async function POST(req: Request) {
  const v = vapid();
  if (!v) return Response.json({ ok: false, sent: false, reason: "Máy chủ chưa có khoá VAPID (VAPID_PRIVATE_KEY)" }, { status: 500 });

  const { pin, orderId } = (await req.json().catch(() => ({}))) as { pin?: string; orderId?: string };
  if (!pin || !orderId) return Response.json({ ok: false, sent: false, reason: "Thiếu PIN hoặc mã đơn" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ ok: false, sent: false, reason: "Chưa cấu hình Supabase" }, { status: 500 });
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Hàm trong Supabase tự kiểm tra PIN nhân viên
  const { data, error } = await sb.rpc("staff_push_target", { p_pin: pin, p_order: orderId });
  if (error) return Response.json({ ok: false, sent: false, reason: error.message }, { status: 403 });
  const t = data as { id: string; code: string | null; status: string; subscription: unknown };
  if (t.status !== "done") return Response.json({ ok: false, sent: false, reason: "Đơn chưa ở trạng thái Đã xong" });
  if (!t.subscription) return Response.json({ ok: true, sent: false, reason: "khách chưa bật thông báo" });

  try {
    await sendNotification(
      t.subscription as Parameters<typeof sendNotification>[0],
      JSON.stringify({
        title: "Mộc Coffee",
        body: `Đơn #${t.code} đã xong, mời bạn ra quầy nhận`,
        tag: `order-${t.id}`,
        url: `orders/?id=${t.id}`,
      }),
      { TTL: 1800, urgency: "high", vapidDetails: v },
    );
    return Response.json({ ok: true, sent: true });
  } catch (e) {
    const err = e as { statusCode?: number; message?: string };
    // Điện thoại đã huỷ đăng ký → xoá để lần sau khỏi gửi
    if (err.statusCode === 404 || err.statusCode === 410) await sb.rpc("staff_clear_push", { p_pin: pin, p_order: orderId });
    return Response.json({ ok: false, sent: false, reason: `gửi thông báo lỗi (${err.statusCode ?? err.message})` });
  }
}
