// Edge Function: gửi Web Push "Đơn #A12 đã xong…"
// Được gọi bởi trigger orders_done_push (pg_net) khi đơn chuyển sang "Đã xong".
// Khoá VAPID nằm trong bảng private.settings và được trigger gửi kèm;
// hàm chỉ chấp nhận khoá công khai của chính app (không thể bị dùng để gửi hộ người khác).
import webpush from "npm:web-push@3.6.7";

const APP_VAPID_PUBLIC_KEY = "BHfOcQS30pM4I8QDhdSKhMQV75ZCX0jf5ZwwPqelCiQNW2P_ihnEkDLIK4ctDiTXQpB-GFo9cKu3nmzttliN08Q";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  try {
    const { subscription, title, body, tag, url, vapid } = await req.json();
    if (!vapid || vapid.publicKey !== APP_VAPID_PUBLIC_KEY) {
      return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    webpush.setVapidDetails(vapid.subject || "mailto:admin@example.com", vapid.publicKey, vapid.privateKey);
    const res = await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, tag, url }),
      { TTL: 1800, urgency: "high" },
    );
    return Response.json({ ok: true, status: res.statusCode });
  } catch (e) {
    const err = e as { statusCode?: number; message?: string; body?: string };
    console.error("push failed", err.statusCode, err.message, err.body);
    return Response.json({ ok: false, status: err.statusCode ?? null, error: err.message ?? String(e) });
  }
});
