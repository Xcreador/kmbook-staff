/**
 * KMBOOK Staff · Push V1 — enrutado y validación del payload (funciones puras).
 *
 * El worker de Core envía la misma Push a todos los dispositivos de la usuaria
 * (Business y Staff). Su `url` apunta a rutas de Business (`/app/...`), que no
 * existen en Staff: aquí se traduce a la pantalla equivalente de Staff. La
 * lógica está duplicada literalmente en `public/sw.js` (el SW no importa
 * módulos); `push-routing.test.ts` comprueba ambas.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const STAFF_FALLBACK_URL = "/notifications";

export type StaffPushPayload = {
  url?: unknown;
  tag?: unknown;
  data?: { eventType?: unknown; url?: unknown } | null;
};

/** Destino en Staff: sólo rutas propias; nunca una URL externa ni con tokens. */
export function staffDestination(payload: StaffPushPayload | null | undefined): string {
  const eventType = typeof payload?.data?.eventType === "string" ? payload.data.eventType : "";
  const rawUrl = typeof payload?.url === "string" ? payload.url : typeof payload?.data?.url === "string" ? payload.data.url : "";

  if (eventType === "push.test") return "/profile/push";
  if (eventType.startsWith("task.")) return "/tasks";
  if (eventType.startsWith("appointment.")) {
    const match = /[?&]appointment=([0-9a-f-]{36})(?:&|$)/.exec(rawUrl);
    if (match && UUID.test(match[1])) return `/appointments/${match[1]}`;
    return "/agenda";
  }
  return STAFF_FALLBACK_URL;
}

export function safeTag(tag: unknown): string {
  return typeof tag === "string" && /^[a-z0-9_-]{1,120}$/.test(tag) ? tag : "kmbook-staff-notification";
}

export type PushSupport = "supported" | "ios_needs_install" | "insecure_context" | "unsupported";

export function detectPushSupport(input: {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  isSecureContext: boolean;
  userAgent: string;
  isStandalone: boolean;
}): PushSupport {
  if (!input.isSecureContext) return "insecure_context";
  const appleMobile = /iPhone|iPad|iPod/i.test(input.userAgent);
  if (appleMobile && !input.isStandalone) return "ios_needs_install";
  if (!input.hasServiceWorker || !input.hasPushManager || !input.hasNotification) return "unsupported";
  return "supported";
}

export function isValidVapidPublicKey(value: string | undefined | null): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{86,88}$/.test(value);
}

export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  const os = /iPhone/i.test(ua) ? "iPhone" : /iPad/i.test(ua) ? "iPad" : /Android/i.test(ua) ? "Android"
    : /Windows/i.test(ua) ? "Windows" : /Mac OS X|Macintosh/i.test(ua) ? "macOS" : "dispositivo";
  const browser = /Edg\//i.test(ua) ? "Edge" : /Firefox\//i.test(ua) ? "Firefox" : /Chrome\//i.test(ua) ? "Chrome"
    : /Safari\//i.test(ua) ? "Safari" : "Navegador";
  // Prefijo «Staff» para distinguirlo en el listado de dispositivos de Business.
  return `Staff · ${browser} en ${os}`;
}
