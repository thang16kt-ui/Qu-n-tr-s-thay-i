"use client";

export const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export type PushState = "unsupported" | "ios-needs-install" | "default" | "granted" | "denied" | "no-key";

export function pushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  if (!pushSupported()) return isIOS() && !isStandalone() ? "ios-needs-install" : "unsupported";
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "no-key";
  return Notification.permission as PushState;
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    return await navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` });
  } catch {
    return null;
  }
}

function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Lấy subscription hiện có (không hỏi quyền) */
export async function currentSubscription(): Promise<PushSubscriptionJSON | null> {
  if (pushState() !== "granted") return null;
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerSW());
  const sub = await reg?.pushManager.getSubscription();
  return sub ? sub.toJSON() : null;
}

/** Hỏi quyền + đăng ký nhận push. Phải gọi từ một cú bấm của người dùng. */
export async function enablePush(): Promise<PushSubscriptionJSON | null> {
  if (!pushSupported()) return null;
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return null;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;
  const reg = (await registerSW()) ?? (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key) });
  return sub.toJSON();
}
