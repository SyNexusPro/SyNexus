/* SyNexus Pro — whale alert Web Push service worker */
self.addEventListener("push", (event) => {
  let data = { title: "🐋 Whale buy", body: "Large buy detected", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Whale buy", {
      body: data.body || "Large buy detected",
      icon: data.icon || undefined,
      data: { url: data.url || "/" },
      renotify: true,
      tag: data.tag || "synexus-whale",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(target) && "focus" in client) return client.focus();
      }
      for (const client of list) {
        if ("focus" in client && client.navigate) {
          return client.navigate(target).then((next) => (next || client).focus());
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
    }),
  );
});
