import "server-only";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

/**
 * Cookie httpOnly con el hash SHA-256 del endpoint Push de este navegador
 * (nunca el endpoint, que es una capacidad). Permite dar de baja el
 * dispositivo al cerrar sesión o cambiar de negocio.
 */
export const STAFF_PUSH_DEVICE_COOKIE = "kmbook_staff_push_device";
const HASH = /^[0-9a-f]{64}$/;

export async function rememberPushDevice(endpointHash: string): Promise<void> {
  if (!HASH.test(endpointHash)) return;
  (await cookies()).set(STAFF_PUSH_DEVICE_COOKIE, endpointHash, {
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

/** Baja del dispositivo para la cuenta activa. Nunca lanza: el cierre de sesión no depende de Push. */
export async function releasePushDevice(): Promise<void> {
  try {
    const store = await cookies();
    const hash = store.get(STAFF_PUSH_DEVICE_COOKIE)?.value;
    if (!hash || !HASH.test(hash)) return;
    const supabase = await createClient();
    await supabase.rpc("unregister_push_subscription_by_hash", { p_endpoint_hash: hash });
    store.delete(STAFF_PUSH_DEVICE_COOKIE);
  } catch {
    // La suscripción caduca igualmente (404/410) o se transfiere al registrarla otra cuenta.
  }
}
