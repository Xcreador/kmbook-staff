"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/kmbook/auth";
import { createClient } from "@/lib/supabase/server";
import { getHumanErrorMessage } from "@/lib/kmbook/errors";
import type { AppointmentStatus } from "@/types/database";

export type ExecutionResult = {
  success: boolean;
  message: string;
  startedAt?: string;
  finishedAt?: string;
  durationSeconds?: number;
};

export async function startStudioServiceAction(
  organizationId: string,
  appointmentId: string,
  itemId: string,
): Promise<ExecutionResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: "Tu sesión ha caducado. Vuelve a iniciar sesión." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_studio_service", {
      p_organization_id: organizationId,
      p_appointment_id: appointmentId,
      p_item_id: itemId,
    });

    if (error) {
      return { success: false, message: getHumanErrorMessage(error) };
    }

    revalidatePath("/today");
    revalidatePath("/agenda");
    revalidatePath(`/appointments/${appointmentId}`);

    return {
      success: true,
      message: "Servicio iniciado correctamente.",
      startedAt: data,
    };
  } catch (err) {
    return { success: false, message: getHumanErrorMessage(err) };
  }
}

export async function finishStudioServiceAction(
  organizationId: string,
  appointmentId: string,
  itemId: string,
): Promise<ExecutionResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: "Tu sesión ha caducado. Vuelve a iniciar sesión." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("finish_studio_service", {
      p_organization_id: organizationId,
      p_appointment_id: appointmentId,
      p_item_id: itemId,
    });

    if (error) {
      return { success: false, message: getHumanErrorMessage(error) };
    }

    const firstResult = data && data[0];

    revalidatePath("/today");
    revalidatePath("/agenda");
    revalidatePath(`/appointments/${appointmentId}`);

    return {
      success: true,
      message: "Servicio finalizado con éxito.",
      finishedAt: firstResult?.actual_finished_at,
      durationSeconds: firstResult?.actual_duration_seconds,
    };
  } catch (err) {
    return { success: false, message: getHumanErrorMessage(err) };
  }
}

export async function updateAppointmentStatusAction(
  organizationId: string,
  appointmentId: string,
  status: AppointmentStatus,
  cancellationReason?: string,
): Promise<ExecutionResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: "Tu sesión ha caducado. Vuelve a iniciar sesión." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("change_studio_appointment_status", {
      p_organization_id: organizationId,
      p_appointment_id: appointmentId,
      p_status: status,
      p_cancellation_reason: cancellationReason ?? null,
    });

    if (error) {
      return { success: false, message: getHumanErrorMessage(error) };
    }

    revalidatePath("/today");
    revalidatePath("/agenda");
    revalidatePath(`/appointments/${appointmentId}`);

    return {
      success: true,
      message: "Estado de la cita actualizado.",
    };
  } catch (err) {
    return { success: false, message: getHumanErrorMessage(err) };
  }
}
