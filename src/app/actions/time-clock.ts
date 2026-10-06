"use server";

import { revalidatePath } from "next/cache";
import { getStaffTimeClockAccess } from "@/lib/kmbook/staff-time-clock-access";
import { createClient } from "@/lib/supabase/server";
import {
  ACTION_TO_CORE_MAP,
  getAttendanceErrorMessage,
  fetchTodaySessionFromSupabase,
  fetchHistoryFromSupabase,
  fetchActiveLocationsFromSupabase,
  timeClockUnavailableMessage,
  TIME_CLOCK_UNAVAILABLE_TITLE,
  type TimeClockAction,
  type TimeClockResponse,
  type TimeClockShift,
  type ShiftHistoryEntry,
} from "@/lib/kmbook/time-clock";

/**
 * Fichaje personal desde KMBOOK Staff. TODAS las acciones pasan por
 * getStaffTimeClockAccess: sesión, organización activa con membresía activa,
 * organización de la petición == organización activa, y ajuste de Core
 * `get_staff_organization_settings` estrictamente activado. Si algo falla, no
 * se escribe ni se lee nada (fail-closed), aunque el cliente esté manipulado.
 *
 * Staff nunca cambia el ajuste: eso se hace en Business (Fichaje → Configuración).
 */
export async function clockAction(params: {
  organizationId: string;
  locationId?: string | null;
  action: TimeClockAction;
  idempotencyKey: string;
}): Promise<TimeClockResponse> {
  const coreAction = ACTION_TO_CORE_MAP[params?.action];
  if (!coreAction || typeof params.idempotencyKey !== "string" || params.idempotencyKey.length === 0) {
    return { success: false, message: "Acción de fichaje no válida." };
  }

  const access = await getStaffTimeClockAccess(params.organizationId);
  if (!access.allowed) {
    const detail = timeClockUnavailableMessage(access.reason);
    const bare = access.reason === "session" || access.reason === "organization_changed" || access.reason === "organization";
    return { success: false, blocked: true, message: bare ? detail : `${TIME_CLOCK_UNAVAILABLE_TITLE}. ${detail}` };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("studio_attendance_clock", {
      p_organization_id: access.organization.id,
      p_location_id: params.locationId ?? null,
      p_action: coreAction,
      p_idempotency_key: params.idempotencyKey,
    });

    if (error) {
      return { success: false, message: getAttendanceErrorMessage(error.message) };
    }

    revalidatePath("/today");
    revalidatePath("/time-clock");

    const updatedShift = await fetchTodaySessionFromSupabase(supabase, access.organization.id, access.viewer.user.id, access.organization.timezone);
    return { success: true, message: "Fichaje registrado.", shift: updatedShift };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: getAttendanceErrorMessage(msg) };
  }
}

export async function getTodaySessionAction(organizationId: string): Promise<TimeClockShift> {
  const access = await getStaffTimeClockAccess(organizationId);
  if (!access.allowed) {
    throw new Error(timeClockUnavailableMessage(access.reason));
  }
  const supabase = await createClient();
  return fetchTodaySessionFromSupabase(supabase, access.organization.id, access.viewer.user.id, access.organization.timezone);
}

export async function getHistoryAction(organizationId: string, limit = 30): Promise<ShiftHistoryEntry[]> {
  const access = await getStaffTimeClockAccess(organizationId);
  if (!access.allowed) return [];
  const supabase = await createClient();
  return fetchHistoryFromSupabase(supabase, access.organization.id, access.viewer.user.id, limit);
}

export async function getActiveLocationsAction(
  organizationId: string,
): Promise<Array<{ id: string; name: string; timezone: string }>> {
  const access = await getStaffTimeClockAccess(organizationId);
  if (!access.allowed) return [];
  const supabase = await createClient();
  return fetchActiveLocationsFromSupabase(supabase, access.organization.id);
}
