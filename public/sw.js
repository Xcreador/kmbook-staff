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

/** Recursos estáticos cacheables: no contienen datos de organización ni de usuaria. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/globals.css" ||
    /^\/icon(-\d+)?(\.png)?$/.test(url.pathname) ||
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

// ---------------------------------------------------------------------------
// Push V1. El worker de Core envía la misma Push a todos los dispositivos de la
// usuaria; su `url` apunta a rutas de Business (`/app/...`). Aquí se traduce a
// la pantalla de Staff. Copia literal de src/lib/kmbook/push-routing.ts
// (staffDestination / safeTag): cualquier cambio, en los dos sitios.
// ---------------------------------------------------------------------------
const STAFF_FALLBACK_URL = "/notifications";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function staffDestination(payload) {
  const data = payload && typeof payload.data === "object" && payload.data ? payload.data : {};
  const eventType = typeof data.eventType === "string" ? data.eventType : "";
  const rawUrl = typeof payload?.url === "string" ? payload.url : typeof data.url === "string" ? data.url : "";
  if (eventType === "push.test") return "/profile/push";
  if (eventType.startsWith("task.")) return "/today";
  if (eventType.startsWith("appointment.")) {
    const match = /[?&]appointment=([0-9a-f-]{36})(?:&|$)/.exec(rawUrl);
    if (match && UUID_RE.test(match[1])) return "/appointments/" + match[1];
    return "/agenda";
  }
  return STAFF_FALLBACK_URL;
}

function safeTag(tag) {
  return typeof tag === "string" && /^[a-z0-9_-]{1,120}$/.test(tag) ? tag : "kmbook-staff-notification";
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  // Texto genérico desde Core (sin datos de clientas). Nunca se muestra texto plano arbitrario.
  const title = typeof payload.title === "string" && payload.title ? payload.title.slice(0, 120) : "KMBOOK Staff";
  const body = typeof payload.body === "string" && payload.body ? payload.body.slice(0, 240) : "Tienes un aviso nuevo.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: safeTag(payload.tag),
      data: { url: staffDestination(payload) },
    }),
  );
});

// Al pulsar: sólo rutas propias de Staff; la app vuelve a comprobar sesión,
// negocio activo y permisos (una cita ajena da «sin acceso»).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data && typeof event.notification.data.url === "string" &&
    event.notification.data.url.startsWith("/") && !event.notification.data.url.startsWith("//")
    ? event.notification.data.url
    : STAFF_FALLBACK_URL;
  let target = new URL(path, self.location.origin);
  // «/\\host» empieza por «/» pero el navegador lo normaliza a otro origen: se comprueba el origen final.
  if (target.origin !== self.location.origin) target = new URL(STAFF_FALLBACK_URL, self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === target.origin && "focus" in client) {
          return client.focus().then((focused) => (focused && "navigate" in focused ? focused.navigate(target.href) : undefined));
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target.href) : undefined;
    }),
  );
});
