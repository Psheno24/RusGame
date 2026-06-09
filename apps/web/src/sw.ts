/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//],
  }),
);

type PushMessage = {
  title?: string;
  body?: string;
  url?: string;
};

self.addEventListener("push", (event) => {
  let data: PushMessage = {};
  try {
    data = (event.data?.json() as PushMessage | undefined) ?? {};
  } catch {
    data = { body: event.data?.text() ?? "" };
  }
  const title = data.title?.trim() || data.body?.trim() || "Уведомление";
  const body = data.title?.trim() ? (data.body ?? "") : "";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: data.url ?? "default",
      data: { url: data.url ?? "/work" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string | undefined) ?? "/work";
  const target = new URL(url, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          void client.focus();
          return;
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

export {};
