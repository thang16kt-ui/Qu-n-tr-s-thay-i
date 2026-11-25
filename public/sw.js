/* Service worker của Mộc Coffee: nhận Web Push và mở app khi bấm thông báo */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Mộc Coffee";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag || "moc-order",
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url || "qr/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rel = ((event.notification.data && event.notification.data.url) || "qr/").replace(/^\//, "");
  const url = new URL(rel, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
