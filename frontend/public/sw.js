// Shows Rock Works notifications (a meeting scheduled, moved, cancelled, starting) sent by the server
// as browser push, and opens the page they point at when clicked. Registered from the Notifications
// page only after the person turns push on.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Rock Works", {
      body: data.body || "",
      tag: data.tag,
      icon: "/rockworks-icon.svg",
      data: { url: data.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/notifications", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) if (w.url === url && "focus" in w) return w.focus();
      return self.clients.openWindow(url);
    }),
  );
});
