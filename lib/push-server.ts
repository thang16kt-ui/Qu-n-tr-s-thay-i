import "server-only";
import { sendNotification, type PushSubscription, type VapidDetails } from "web-push";
import { sbAdmin } from "./supabase-admin";

function vapid(): VapidDetails | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { subject: process.env.VAPID_SUBJECT || "mailto:admin@moc.coffee", publicKey, privateKey };
}

/** Gửi "Đơn #A12 đã xong, mời bạn ra quầy nhận". Trả về true nếu gửi được. */
export async function pushOrderDone(order: { id: string; code: string; push_subscription: unknown }): Promise<boolean> {
  const vapidDetails = vapid();
  if (!order.push_subscription || !vapidDetails) return false;
  try {
    await sendNotification(
      order.push_subscription as PushSubscription,
      JSON.stringify({
        title: "Mộc Coffee",
        body: `Đơn #${order.code} đã xong, mời bạn ra quầy nhận`,
        url: "/qr",
        tag: `order-${order.id}`,
      }),
      { TTL: 60 * 30, urgency: "high", vapidDetails }
    );
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) {
      // subscription hết hiệu lực → xoá
      await sbAdmin().from("orders").update({ push_subscription: null }).eq("id", order.id);
    }
    console.error("Push lỗi:", code, (e as Error).message);
    return false;
  }
}
