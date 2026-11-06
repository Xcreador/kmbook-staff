"use server";

import { createHash } from "node:crypto";

import { z } from "zod";

import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { forgetPushDevice, rememberPushDevice } from "@/lib/kmbook/push-device";
import { createClient } from "@/lib/supabase/server";

/**
 * KMBOOK Staff · Push V1 — alta, baja, dispositivos, preferencias y prueba.
 *
 * Reutiliza las RPC de Core (las mismas que Business). La organización NUNCA
 * llega del navegador: es la organización activa verificada por
 * `getStaffViewerContext` (membresía activa). Core vuelve a exigir membresía
 * activa y filas propias en cada RPC. Nunca se devuelven endpoints ni claves.
 */

export type StaffPushResult = { ok: true; message?: string } | { ok: false; message: string };
export type StaffPushDevice = { id: string; label: string; createdAt: string; lastSuccessAt: string | null; isCurrent: boolean };
export type StaffPushPreference = { eventType: string; title: string; push: boolean };

const endpointSchema = z.string().trim().min(20).max(2000).url();
const keySchema = z.string().trim().max(120).regex(/^[A-Za-z0-9_-]+={0,2}$/);
const subscribeSchema = z.object({
  endpoint: endpointSchema,
  p256dh: keySchema,
  auth: keySchema,
  deviceLabel: z.string().trim().max(80).optional(),
  userAgent: z.string().max(300).optional(),
});

async function activeOrganizationId(): Promise<string | null> {
  const viewer = await getStaffViewerContext();
  return viewer?.activeOrganization?.id ?? null;
}

async function publicError(message: string | undefined): Promise<string> {
  if (!message) return "No se pudo completar la operación.";
  if (message.includes("push_device_limit_reached")) return "Has alcanzado el máximo de 10 dispositivos. Desactiva alguno antes de añadir otro.";
  if (message.includes("invalid_push_endpoint")) return "Este navegador ha devuelto una suscripción no admitida.";
  if (message.includes("push_test_rate_limited")) return "Ya se ha enviado una prueba en el último minuto.";
  if (message.includes("push_not_subscribed")) return "Activa las notificaciones en este dispositivo antes de enviar una prueba.";
  if (message.includes("authorization_required")) return "No tienes acceso a este negocio.";
  return "No se pudo completar la operación.";
}

export async function subscribeStaffPushAction(input: z.input<typeof subscribeSchema>): Promise<StaffPushResult> {
  const organizationId = await activeOrganizationId();
  if (!organizationId) return { ok: false, message: "Selecciona un negocio antes de activar las notificaciones." };
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Suscripción no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_push_subscription", {
    p_organization_id: organizationId,
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.p256dh,
    p_auth: parsed.data.auth,
    p_device_label: parsed.data.deviceLabel ?? null,
    p_user_agent: parsed.data.userAgent ?? null,
  });
  if (error) return { ok: false, message: await publicError(error.message) };
  await rememberPushDevice(createHash("sha256").update(parsed.data.endpoint.trim()).digest("hex"));
  return { ok: true };
}

export async function unsubscribeStaffPushAction(endpoint: string): Promise<StaffPushResult> {
  if (!(await getStaffViewerContext())) return { ok: false, message: "Tu sesión ha caducado." };
  const parsed = endpointSchema.safeParse(endpoint);
  if (!parsed.success) return { ok: false, message: "Suscripción no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("unregister_push_subscription", { p_endpoint: parsed.data });
  if (error) return { ok: false, message: await publicError(error.message) };
  await forgetPushDevice();
  return { ok: true };
}

export async function revokeStaffPushDeviceAction(subscriptionId: string): Promise<StaffPushResult> {
  if (!(await getStaffViewerContext())) return { ok: false, message: "Tu sesión ha caducado." };
  const parsed = z.string().uuid().safeParse(subscriptionId);
  if (!parsed.success) return { ok: false, message: "Dispositivo no válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_my_push_subscription", { p_subscription_id: parsed.data });
  if (error) return { ok: false, message: await publicError(error.message) };
  return { ok: true };
}

export async function listStaffPushDevicesAction(currentEndpoint: string | null): Promise<StaffPushDevice[]> {
  const organizationId = await activeOrganizationId();
  if (!organizationId) return [];
  const current = currentEndpoint && endpointSchema.safeParse(currentEndpoint).success ? currentEndpoint : null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_my_push_subscriptions", {
    p_organization_id: organizationId,
    p_current_endpoint: current,
  });
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.device_label ?? "Dispositivo",
    createdAt: row.created_at,
    lastSuccessAt: row.last_success_at,
    isCurrent: row.is_current,
  }));
}

const preferenceSchema = z.object({ eventType: z.string().regex(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/), enabled: z.boolean() });

export async function setStaffPushPreferenceAction(input: z.input<typeof preferenceSchema>): Promise<StaffPushResult> {
  const organizationId = await activeOrganizationId();
  if (!organizationId) return { ok: false, message: "Selecciona un negocio." };
  const parsed = preferenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Preferencia no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_push_preference", {
    p_organization_id: organizationId,
    p_event_type: parsed.data.eventType,
    p_enabled: parsed.data.enabled,
  });
  if (error) return { ok: false, message: await publicError(error.message) };
  return { ok: true };
}

export async function sendStaffPushTestAction(): Promise<StaffPushResult> {
  const organizationId = await activeOrganizationId();
  if (!organizationId) return { ok: false, message: "Selecciona un negocio." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_push_test", { p_organization_id: organizationId });
  if (error) return { ok: false, message: await publicError(error.message) };
  // La entrega la procesa el worker de Core (cron cada minuto). «En cola» no es «recibida».
  return { ok: true, message: "Prueba en cola. Debería llegar a este dispositivo en menos de un minuto." };
}
