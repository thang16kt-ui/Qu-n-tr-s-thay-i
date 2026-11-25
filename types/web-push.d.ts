// web-push 4.x không kèm sẵn kiểu TypeScript — khai báo phần app dùng
declare module "web-push" {
  export type PushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
  export type RequestOptions = {
    TTL?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
    vapidDetails?: { subject: string; publicKey: string; privateKey: string };
  };
  export function sendNotification(sub: PushSubscription, payload?: string, options?: RequestOptions): Promise<{ statusCode: number }>;
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };
}
