import "server-only";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

/**
 * Cookie httpOnly que asocia ESTE navegador a su suscripción Push:
 * `<organizationId>:<sha256(endpoint)>`. Nunca guarda el endpoint (es una
 * capacidad). Sirve para dar de baja el dispositivo al cerrar sesión o al
 * cambiar de negocio, por cualquier camino.
 */
export const STAFF_PUSH_DEVICE_COOKIE = "kmbook_staff_push_device";
const VALUE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([0-9a-f]{64})$/;

export type PushReleaseResult = "released" | "none" | "failed";

export function parsePushDeviceCookie(value: string | undefined): { organizationId: string; hash: string } | null {
  const match = value ? VALUE.exec(value) : null;
  return match ? { organizationId: match[1], hash: match[2] } : null;
}

export async function rememberPushDevice(organizationId: string, endpointHash: string): Promise<void> {
  const value = `${organizationId}:${endpointHash}`;
  if (!VALUE.test(value)) return;
  (await cookies()).set(STAFF_PUSH_DEVICE_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
}

export async function forgetPushDevice(): Promise<void> {
  (await cookies()).delete(STAFF_PUSH_DEVICE_COOKIE);
}

/**
 * Baja del dispositivo en Core para la cuenta activa. Nunca lanza: el cierre de
 * sesión o el cambio de negocio no dependen de Push. Si Core falla devuelve
 * "failed" y CONSERVA la cookie; la garantía de que el dispositivo deja de
 * recibir la da además el navegador (`releaseBrowserPush`), que anula la
 * suscripción en el servicio Push: los envíos posteriores responden 404/410 y
 * Core poda la fila.
 */
export async function releasePushDevice(): Promise<PushReleaseResult> {
  try {
    const store = await cookies();
    const device = parsePushDeviceCookie(store.get(STAFF_PUSH_DEVICE_COOKIE)?.value);
    if (!device) return "none";
    const supabase = await createClient();
    const { error } = await supabase.rpc("unregister_push_subscription_by_hash", { p_endpoint_hash: device.hash });
    if (error) return "failed";
    store.delete(STAFF_PUSH_DEVICE_COOKIE);
    return "released";
  } catch {
    return "failed";
  }
}

/** Cambio de negocio por cualquier camino: si el dispositivo estaba en OTRA organización, se da de baja. */
export async function releasePushDeviceIfOrganizationChanges(nextOrganizationId: string): Promise<PushReleaseResult> {
  try {
    const device = parsePushDeviceCookie((await cookies()).get(STAFF_PUSH_DEVICE_COOKIE)?.value);
    if (!device || device.organizationId === nextOrganizationId) return "none";
  } catch {
    return "none";
  }
  return releasePushDevice();
}
