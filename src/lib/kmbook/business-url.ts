import "server-only";

/**
 * Resolvedor de la URL de KMBOOK Business (solo servidor).
 *
 * Staff no conoce ninguna URL de Business por defecto: se configura con
 * `KMBOOK_BUSINESS_URL` (o, por compatibilidad, `NEXT_PUBLIC_BUSINESS_URL`).
 * Si falta o no es válida, el acceso se OCULTA (cerrado por defecto).
 *
 * Reglas: `https` obligatorio (solo `http://localhost` / `127.0.0.1` fuera de
 * producción); sin credenciales, ruta, consulta ni fragmento; el host debe ser
 * un dominio con punto (sin IP, sin nombres de una sola etiqueta). Se normaliza
 * a `origin`.
 *
 * Un enlace oculto no sustituye la autorización: Core revalida el permiso al
 * llegar a Business.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const DNS_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export type BusinessPath = "/app/studio" | "/app/studio/pos";

export function parseBusinessOrigin(raw: string | undefined | null, nodeEnv: string | undefined = process.env.NODE_ENV): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || /[\s\\]/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== "/" || value.includes("?") || value.includes("#")) return null;

  const host = url.hostname.toLowerCase();
  const isLocal = LOCAL_HOSTS.has(host);

  if (url.protocol === "http:") {
    if (!isLocal || nodeEnv === "production") return null;
    return url.origin;
  }
  if (url.protocol !== "https:") return null;
  if (isLocal) return nodeEnv === "production" ? null : url.origin;

  // Dominio real: etiquetas DNS válidas, al menos dos, TLD no numérico (descarta IPs).
  const labels = host.split(".");
  if (labels.length < 2 || !labels.every((label) => DNS_LABEL.test(label))) return null;
  if (/^\d+$/.test(labels[labels.length - 1])) return null;
  if (url.port) return null;
  return url.origin;
}

export function getBusinessOrigin(): string | null {
  return parseBusinessOrigin(process.env.KMBOOK_BUSINESS_URL || process.env.NEXT_PUBLIC_BUSINESS_URL);
}

/** URL absoluta hacia una ruta de Business, o `null` (ocultar el acceso). */
export function buildBusinessUrl(path: BusinessPath, origin: string | null = getBusinessOrigin()): string | null {
  return origin ? `${origin}${path}` : null;
}
