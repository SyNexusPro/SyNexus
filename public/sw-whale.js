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
      data: { url: data.url || "/" },
      renotify: true,
      tag: "synexus-whale",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate?.(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
