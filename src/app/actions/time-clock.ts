"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser, getStaffViewerContext } from "@/lib/kmbook/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ACTION_TO_CORE_MAP,
  getAttendanceErrorMessage,
  fetchTodaySessionFromSupabase,
  fetchHistoryFromSupabase,
  fetchActiveLocationsFromSupabase,
  type TimeClockAction,
  type TimeClockResponse,
  type TimeClockShift,
  type ShiftHistoryEntry,
} from "@/lib/kmbook/time-clock";

/**
 * Server Action para fichaje personal autenticado.
 * Llama a la RPC Core `studio_attendance_clock`.
 * Valida membership en sesión, pasa clave de idempotencia UUID y traduce errores.
 */
export async function clockAction(params: {
  organizationId: string;
  locationId?: string | null;
  action: TimeClockAction;
  idempotencyKey: string;
}): Promise<TimeClockResponse> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      success: false,
      message: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
    };
  }

  // Confirmar que el usuario pertenece a la organización
  const viewer = await getStaffViewerContext();
  if (!viewer || !viewer.organizations.some((org) => org.id === params.organizationId)) {
    return {
      success: false,
      message: "No tienes permiso para registrar fichajes en esta organización.",
    };
  }

  const coreAction = ACTION_TO_CORE_MAP[params.action];
  if (!coreAction) {
    return { success: false, message: "Acción de fichaje no válida." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("studio_attendance_clock", {
      p_organization_id: params.organizationId,
      p_location_id: params.locationId ?? null,
      p_action: coreAction,
      p_idempotency_key: params.idempotencyKey,
    });

    if (error) {
      return {
        success: false,
        message: getAttendanceErrorMessage(error.message),
      };
    }

    revalidatePath("/today");
    revalidatePath("/time-clock");

    const updatedShift = await fetchTodaySessionFromSupabase(
      supabase,
      params.organizationId,
      user.id,
    );

    return {
      success: true,
      message: "Fichaje registrado.",
      shift: updatedShift,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: getAttendanceErrorMessage(msg),
    };
  }
}

export async function getTodaySessionAction(organizationId: string): Promise<TimeClockShift> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("No autenticado");
  }
  const supabase = await createClient();
  return fetchTodaySessionFromSupabase(supabase, organizationId, user.id);
}

export async function getHistoryAction(
  organizationId: string,
  limit = 30,
): Promise<ShiftHistoryEntry[]> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return [];
  }
  const supabase = await createClient();
  return fetchHistoryFromSupabase(supabase, organizationId, user.id, limit);
}

export async function getActiveLocationsAction(
  organizationId: string,
): Promise<Array<{ id: string; name: string; timezone: string }>> {
  const supabase = await createClient();
  return fetchActiveLocationsFromSupabase(supabase, organizationId);
}
