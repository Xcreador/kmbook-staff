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

/**
 * Obtiene el detalle seguro de una cita para la profesional.
 * Regla 16 & 42: Respeta permisos RLS y capabilities.
 */
export async function getAppointmentDetail(
  organizationId: string,
  appointmentId: string,
): Promise<AppointmentDetail | null> {
  const supabase = await createClient();

  const [appointmentResult, itemsResult, locationResult, capabilities] = await Promise.all([
    supabase
      .from("studio_appointments")
      .select("id, organization_id, location_id, client_id, status, starts_at, ends_at, client_name_snapshot, client_phone_snapshot, operational_notes, cancellation_reason")
      .eq("organization_id", organizationId)
      .eq("id", appointmentId)
      .maybeSingle(),
    supabase
      .from("studio_appointment_items")
      .select("id, service_id, professional_id, service_name_snapshot, professional_name_snapshot, duration_minutes, actual_started_at, actual_finished_at, actual_duration_seconds")
      .eq("organization_id", organizationId)
      .eq("appointment_id", appointmentId)
      .order("position", { ascending: true }),
    supabase.from("locations").select("id, name").eq("organization_id", organizationId),
    getStaffCapabilities(organizationId),
  ]);

  if (appointmentResult.error || !appointmentResult.data) {
    return null;
  }

  const appt = appointmentResult.data;
  const items = itemsResult.data ?? [];
  const locations = locationResult.data ?? [];
  const location = locations.find((l) => l.id === appt.location_id);

  // Obtener "Aviso importante" de la clienta mediante la RPC oficial segura
  let importantNotice: string | null = null;
  let clientTeamNotes: string | null = null;

  if (appt.client_id) {
    try {
      const [noticeRes, clientRes] = await Promise.all([
        supabase.rpc("get_studio_client_notices", {
          p_organization_id: organizationId,
          p_client_ids: [appt.client_id],
        }),
        capabilities.canViewTeamNotes
          ? supabase
              .from("studio_clients")
              .select("team_notes")
              .eq("organization_id", organizationId)
              .eq("id", appt.client_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (noticeRes.data && noticeRes.data.length > 0) {
        importantNotice = noticeRes.data[0].notice || null;
      }
      if (clientRes.data) {
        clientTeamNotes = clientRes.data.team_notes;
      }
    } catch {
      // Ignorar fallo secundario de lectura de aviso
    }
  }

  const processedItems: AppointmentDetailItem[] = items.map((item) => {
    const isRunning = !!item.actual_started_at && !item.actual_finished_at;
    const isDone = !!item.actual_finished_at;
    const isExecutable = (appt.status === "arrived" || appt.status === "in_service") && !isDone;

    return {
      id: item.id,
      serviceId: item.service_id,
      professionalId: item.professional_id,
      serviceName: item.service_name_snapshot,
      professionalName: item.professional_name_snapshot,
      durationMinutes: item.duration_minutes,
      actualStartedAt: item.actual_started_at,
      actualFinishedAt: item.actual_finished_at,
      actualDurationSeconds: item.actual_duration_seconds,
      isExecutable,
      isRunning,
      isDone,
    };
  });

  return {
    id: appt.id,
    organizationId: appt.organization_id,
    locationId: appt.location_id,
    locationName: location?.name || "Centro principal",
    clientId: appt.client_id,
    clientName: capabilities.canViewClientIdentity ? appt.client_name_snapshot : "Clienta",
    clientPhone: capabilities.canViewClientContact ? appt.client_phone_snapshot : null,
    status: appt.status,
    startsAt: appt.starts_at,
    endsAt: appt.ends_at,
    operationalNotes: capabilities.canViewOperationalNotes ? appt.operational_notes : null,
    cancellationReason: appt.cancellation_reason,
    importantNotice,
    teamNotes: clientTeamNotes,
    items: processedItems,
    canReschedule: capabilities.canRescheduleAppointment,
    canCancel: capabilities.canCancelAppointment,
    canChangeStatus: capabilities.canChangeAppointmentStatus,
    canOperate: appt.status === "arrived" || appt.status === "in_service",
  };
}
