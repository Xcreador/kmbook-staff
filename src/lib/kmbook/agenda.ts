import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStaffCapabilities } from "./capabilities";
import type { AppointmentStatus, AvailabilityBlockKind } from "@/types/database";

export type AgendaAppointmentItem = {
  appointmentId: string;
  itemId: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  clientName: string;
  clientPhone: string | null;
  serviceName: string;
  professionalName: string;
  durationMinutes: number;
  actualStartedAt: string | null;
  actualFinishedAt: string | null;
};

export type AgendaBlockItem = {
  id: string;
  kind: AvailabilityBlockKind;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  locationName: string | null;
  professionalName: string | null;
};

export type AgendaContext = {
  organizationId: string;
  selectedDate: string;
  viewMode: "day" | "week";
  appointments: AgendaAppointmentItem[];
  blocks: AgendaBlockItem[];
  canViewTeam: boolean;
};

/**
 * Carga citas y bloqueos de agenda para una fecha o rango semanal.
 */
export async function getAgendaContext(
  organizationId: string,
  selectedDate: string,
  viewMode: "day" | "week" = "day",
  professionalId?: string | null,
): Promise<AgendaContext> {
  const supabase = await createClient();
  const capabilities = await getStaffCapabilities(organizationId);

  let fromDate = selectedDate;
  let toDate = selectedDate;

  if (viewMode === "week") {
    const current = new Date(selectedDate);
    const dayOfWeek = current.getDay(); // 0 is Sunday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(current);
    monday.setDate(current.getDate() - distanceToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    fromDate = monday.toISOString().slice(0, 10);
    toDate = sunday.toISOString().slice(0, 10);
  }

  // Si no tiene capacidad de equipo, filtra estrictamente por su propio ID profesional
  const filterProfId = capabilities.canViewTeamAgenda ? (professionalId ?? null) : (professionalId ?? null);

  const [agendaRes, blocksRes] = await Promise.all([
    supabase.rpc("get_studio_agenda_v3", {
      p_organization_id: organizationId,
      p_from_date: fromDate,
      p_to_date: toDate,
      p_location_id: null,
      p_professional_id: filterProfId,
    }),
    supabase.rpc("get_studio_availability_blocks", {
      p_organization_id: organizationId,
      p_from: `${fromDate}T00:00:00Z`,
      p_to: `${toDate}T23:59:59Z`,
    }),
  ]);

  const appointments: AgendaAppointmentItem[] = (agendaRes.data ?? []).map((row) => ({
    appointmentId: row.appointment_id,
    itemId: row.item_id,
    status: row.status,
    startsAt: row.item_starts_at || row.starts_at,
    endsAt: row.item_ends_at || row.ends_at,
    clientName: capabilities.canViewClientIdentity ? (row.client_name || "Clienta") : "Clienta",
    clientPhone: capabilities.canViewClientContact ? row.client_phone : null,
    serviceName: row.service_name || "Servicio",
    professionalName: row.professional_name || "Profesional",
    durationMinutes: row.duration_minutes || 30,
    actualStartedAt: null,
    actualFinishedAt: null,
  }));

  const blocks: AgendaBlockItem[] = (blocksRes.data ?? []).map((b) => ({
    id: b.block_id,
    kind: b.block_kind,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    reason: b.reason,
    locationName: b.location_name,
    professionalName: b.professional_name,
  }));

  return {
    organizationId,
    selectedDate,
    viewMode,
    appointments,
    blocks,
    canViewTeam: capabilities.canViewTeamAgenda,
  };
}
