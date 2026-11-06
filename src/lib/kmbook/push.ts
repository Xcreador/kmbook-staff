/**
 * Web Push subscription manager para KMBOOK Staff PWA.
 * Regla 28: Push real con deep link al pulsar.
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    // `updateViaCache: "none"`: el navegador nunca reutiliza un sw.js antiguo de su caché HTTP.
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    // Busca una versión nueva al volver a la app (sin recargar nada: el SW nuevo se activa
    // solo, porque no cachea páginas ni datos de sesión).
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") void registration.update().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("online", checkForUpdate);
    return registration;
  } catch {
    return null;
  }
}

export async function subscribeToPush(
  vapidPublicKey?: string,
): Promise<PushSubscription | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      return existingSubscription;
    }

    if (!vapidPublicKey) {
      vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    }

    if (!vapidPublicKey) {
      return null;
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as unknown as BufferSource,
    });

    return subscription;
  } catch {
    return null;
  }
}

export async function getPushSubscriptionState(): Promise<{
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
}> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { isSupported: false, permission: "default", isSubscribed: false };
  }

  const permission = Notification.permission;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return {
      isSupported: true,
      permission,
      isSubscribed: subscription !== null,
    };
  } catch {
    return { isSupported: true, permission, isSubscribed: false };
  }
}

/**
 * Suscripción actual SIN esperar a `serviceWorker.ready` (que no se resuelve si
 * no hay SW registrado y dejaría la pantalla colgada).
 */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return registration ? await registration.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

export type BrowserReleaseResult = "released" | "none" | "failed";

/**
 * Anula la suscripción en el propio navegador (servicio Push). Es la garantía
 * independiente de Core: aunque la baja en el servidor falle, el endpoint deja
 * de existir y los envíos posteriores responden 404/410 (Core poda la fila).
 * Acotada en tiempo: nunca bloquea el cierre de sesión ni el cambio de negocio.
 */
export async function releaseBrowserPush(
  getSubscription: () => Promise<PushSubscription | null> = getCurrentPushSubscription,
  timeoutMs = 3000,
): Promise<BrowserReleaseResult> {
  const work = (async (): Promise<BrowserReleaseResult> => {
    const subscription = await getSubscription();
    if (!subscription) return "none";
    return (await subscription.unsubscribe()) ? "released" : "failed";
  })().catch((): BrowserReleaseResult => "failed");
  const timeout = new Promise<BrowserReleaseResult>((resolve) => setTimeout(() => resolve("failed"), timeoutMs));
  return Promise.race([work, timeout]);
}
