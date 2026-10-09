// v2: la v1 cacheaba páginas HTML autenticadas (Hoy, Fichaje, Agenda…) por
// URL, sin distinguir organización ni usuaria. Al activarse, la v2 borra esa
// caché antigua.
const CACHE_NAME = "kmbook-staff-v2";
// Sólo recursos estáticos sin datos de ninguna organización.
const SHELL_ASSETS = ["/manifest.webmanifest"];

const OFFLINE_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión · KMBOOK Staff</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#F7F6F9;color:#070023}
main{max-width:320px;padding:24px;text-align:center}h1{font-size:18px;margin:0 0 8px}p{font-size:14px;line-height:20px;color:#5B5670;margin:0 0 16px}
button{border:0;border-radius:12px;padding:12px 20px;background:#E6006F;color:#fff;font-size:14px}</style></head>
<body><main><h1>Sin conexión</h1><p>KMBOOK Staff necesita conexión para mostrar tu jornada y registrar fichajes.</p>
<button onclick="location.reload()">Reintentar</button></main></body></html>`;

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
  // Limpia TODAS las cachés de versiones anteriores y toma el control sin recargar.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Recursos estáticos cacheables: no contienen datos de organización ni de usuaria. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/globals.css" ||
    /\.(?:css|js|png|svg|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  // Solo interceptar peticiones GET del propio origen
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Páginas (Hoy, Fichaje, Agenda…), datos RSC y APIs: SIEMPRE de red, nunca
  // de caché. Dependen de la sesión y de la organización activa; servirlas
  // desde caché mezclaría organizaciones (o usuarias en un dispositivo
  // compartido) y mostraría un fichaje que quizá ya no está permitido.
  const isNavigation =
    event.request.mode === "navigate" || event.request.headers.get("accept")?.includes("text/html");
  if (isNavigation) {
    event.respondWith(
      fetch(event.request).catch(
        () => new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }),
      ),
    );
    return;
  }
  if (!isStaticAsset(url)) return;

  // Estáticos: red primero, caché como respaldo sin conexión.
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
        return cached || new Response("Offline", { status: 503, statusText: "Offline" });
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
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
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
        icon: "/icons/icon-192.png",
      }),
    );
  }
});

// Notification click deep-linking
// Regla 28: app cerrada -> llega push -> tap -> abre destino correcto (ej. /appointments/{id})
// Rutas de la app a las que una notificación puede llevar (todas dentro del scope «/»).
const DEEP_LINK_PREFIXES = ["/today", "/agenda", "/appointments/", "/waitlist", "/notifications", "/time-clock", "/schedule", "/profile"];

/**
 * El destino viaja en el payload push: se resuelve SIEMPRE contra el origen de la app,
 * solo se admite el mismo origen («/\\evil.com» o «//evil.com» caerían en otro origen) y
 * solo rutas conocidas de la app; cualquier otra cosa cae en /today.
 */
function resolveNotificationTarget(raw) {
  try {
    const parsed = new URL(String(raw || "/today").trim(), self.location.origin);
    if (parsed.origin !== self.location.origin) return "/today";
    const known = DEEP_LINK_PREFIXES.some((prefix) =>
      prefix.endsWith("/") ? parsed.pathname.startsWith(prefix) : parsed.pathname === prefix || parsed.pathname.startsWith(prefix + "/"),
    );
    return known ? parsed.pathname + parsed.search + parsed.hash : "/today";
  } catch {
    return "/today";
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = resolveNotificationTarget(event.notification.data && event.notification.data.url);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          try {
            // navigate() puede rechazar (p. ej. cliente no controlado): se abre ventana como respaldo.
            const navigated = await client.navigate(targetUrl);
            return (navigated || client).focus();
          } catch {
            break;
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
