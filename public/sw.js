const CACHE_NAME = "kmbook-staff-v1";
const SHELL_ASSETS = ["/", "/today", "/login", "/globals.css", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch(() => {
        // Ignorar fallos de pre-cache durante desarrollo
      });
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// Network-first strategy with cache fallback for offline reads
self.addEventListener("fetch", (event) => {
  // Solo interceptar peticiones GET
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // No interceptar peticiones a Supabase API o Auth para evitar lecturas stale de seguridad
  if (url.hostname.includes("supabase.co")) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Si no hay recurso en caché para una navegación HTML, devolver la shell
        if (event.request.headers.get("accept")?.includes("text/html")) {
          return caches.match("/today") || caches.match("/");
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }),
  );
});

// Push notification handling
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "KMBOOK Staff";
    const options = {
      body: payload.body || "Tienes una nueva actualización en tu agenda.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [100, 50, 100],
      data: payload.data || { url: "/today" },
      tag: payload.tag || "kmbook-staff-notification",
      renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification("KMBOOK Staff", {
        body: text,
        icon: "/icon-192.png",
      }),
    );
  }
});

// Notification click deep-linking
// Regla 28: app cerrada -> llega push -> tap -> abre destino correcto (ej. /appointments/{id})
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/today";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
