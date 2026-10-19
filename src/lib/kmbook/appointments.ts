import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStaffCapabilities } from "./capabilities";
import type { AppointmentStatus } from "@/types/database";

export type AppointmentDetailItem = {
  id: string;
  serviceId: string;
  professionalId: string;
  serviceName: string;
  professionalName: string;
  durationMinutes: number;
  actualStartedAt: string | null;
  actualFinishedAt: string | null;
  actualDurationSeconds: number | null;
  isExecutable: boolean;
  isRunning: boolean;
  isDone: boolean;
};

export type AppointmentDetail = {
  id: string;
  organizationId: string;
  locationId: string;
  locationName: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  operationalNotes: string | null;
  cancellationReason: string | null;
  importantNotice: string | null;
  teamNotes: string | null;
  items: AppointmentDetailItem[];
  canReschedule: boolean;
  canCancel: boolean;
  canChangeStatus: boolean;
  canOperate: boolean;
};

/** Resultado explícito: «no existe», «no es tuya» y «error» nunca se confunden. */
export type AppointmentDetailResult =
  | { kind: "ok"; appointment: AppointmentDetail }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "session_expired" }
  | { kind: "error"; error: unknown };

type DetailItemRow = {
  item_id: string;
  service_id: string;
  professional_id: string;
  service_name: string | null;
  professional_name: string | null;
  duration_minutes: number | null;
  actual_started_at: string | null;
  actual_finished_at: string | null;
  actual_duration_seconds: number | null;
};

type DetailRow = {
  appointment_id: string;
  organization_id: string;
  location_id: string;
  location_name: string | null;
  client_id: string | null;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  client_name: string | null;
  client_phone: string | null;
  client_team_notes: string | null;
  operational_notes: string | null;
  cancellation_reason: string | null;
  items: DetailItemRow[];
};

/** Traduce el error de la RPC a un resultado de dominio. Exportada para los tests. */
export function classifyDetailError(error: { code?: string; message?: string }): AppointmentDetailResult {
  const message = error.message ?? "";
  if (error.code === "P0002" || message.includes("appointment_not_found")) return { kind: "not_found" };
  if (message.includes("authentication_required") || message.includes("JWT expired")) {
    return { kind: "session_expired" };
  }
  if (message.includes("appointment_forbidden") || message.includes("authorization_required")) {
    return { kind: "forbidden" };
  }
  return { kind: "error", error };
}

/**
 * Detalle de una cita para la profesional, vía la RPC `get_studio_appointment_detail`.
 * Las tablas de citas no son legibles directamente (RBAC V2): la RPC aplica las capacidades,
 * redacta los campos y distingue una cita inexistente de una ajena.
 */
export async function getAppointmentDetail(
  organizationId: string,
  appointmentId: string,
): Promise<AppointmentDetailResult> {
  // Un id que no es UUID no puede existir: evita ir a la base de datos.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appointmentId)) {
    return { kind: "not_found" };
  }

  const supabase = await createClient();
  const [detailRes, capabilities] = await Promise.all([
    supabase.rpc("get_studio_appointment_detail", {
      p_organization_id: organizationId,
      p_appointment_id: appointmentId,
    }),
    getStaffCapabilities(organizationId),
  ]);

  if (detailRes.error) return classifyDetailError(detailRes.error);
  const row = detailRes.data as unknown as DetailRow | null;
  if (!row) return { kind: "not_found" };

  // Aviso importante de la clienta mediante la RPC oficial; un fallo aquí no tumba el detalle.
  let importantNotice: string | null = null;
  if (row.client_id) {
    try {
      const noticeRes = await supabase.rpc("get_studio_client_notices", {
        p_organization_id: organizationId,
        p_client_ids: [row.client_id],
      });
      if (noticeRes.data && noticeRes.data.length > 0) {
        importantNotice = noticeRes.data[0].notice || null;
      }
    } catch {
      // Lectura secundaria.
    }
  }

  const items: AppointmentDetailItem[] = (row.items ?? []).map((item) => {
    const isRunning = !!item.actual_started_at && !item.actual_finished_at;
    const isDone = !!item.actual_finished_at;
    return {
      id: item.item_id,
      serviceId: item.service_id,
      professionalId: item.professional_id,
      serviceName: item.service_name ?? "Servicio",
      professionalName: item.professional_name ?? "Profesional",
      durationMinutes: item.duration_minutes ?? 0,
      actualStartedAt: item.actual_started_at,
      actualFinishedAt: item.actual_finished_at,
      actualDurationSeconds: item.actual_duration_seconds,
      isExecutable: (row.status === "arrived" || row.status === "in_service") && !isDone,
      isRunning,
      isDone,
    };
  });

  return {
    kind: "ok",
    appointment: {
      id: row.appointment_id,
      organizationId: row.organization_id,
      locationId: row.location_id,
      locationName: row.location_name || "Centro principal",
      clientId: row.client_id ?? "",
      clientName: row.client_name ?? "Clienta",
      clientPhone: row.client_phone,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      operationalNotes: row.operational_notes,
      cancellationReason: row.cancellation_reason,
      importantNotice,
      teamNotes: row.client_team_notes,
      items,
      canReschedule: capabilities.canRescheduleAppointment,
      canCancel: capabilities.canCancelAppointment,
      canChangeStatus: capabilities.canChangeAppointmentStatus,
      canOperate: row.status === "arrived" || row.status === "in_service",
    },
  };
}
