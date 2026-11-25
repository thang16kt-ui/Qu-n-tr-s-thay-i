declare module "web-push" {
  export type PushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
  export type VapidDetails = { subject: string; publicKey: string; privateKey: string };
  export function sendNotification(
    sub: PushSubscription,
    payload?: string,
    options?: { TTL?: number; urgency?: "very-low" | "low" | "normal" | "high"; vapidDetails?: VapidDetails }
  ): Promise<{ statusCode: number }>;
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };
}
