self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text?.() || "" };
  }

  const title = payload.title || "EYAD AI";
  const options = {
    body: payload.body || "لديك تحديث جديد في EYAD AI.",
    icon: payload.icon || "/eyad-icon.png",
    badge: payload.badge || "/eyad-icon.png",
    data: { url: payload.url || "/" },
    tag: payload.tag || "eyad-notification",
    renotify: Boolean(payload.renotify),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        existing.navigate(target);
        return existing.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
