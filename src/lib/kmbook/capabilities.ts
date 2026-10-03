import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type StaffCapabilities = {
  canViewOwnAgenda: boolean;
  canViewTeamAgenda: boolean;
  canViewService: boolean;
  canViewClientIdentity: boolean;
  canViewClientContact: boolean;
  canViewOperationalNotes: boolean;
  canRescheduleAppointment: boolean;
  canCancelAppointment: boolean;
  canChangeAppointmentStatus: boolean;
  canViewClientBasic: boolean;
  canViewClientContactInfo: boolean;
  canViewTeamNotes: boolean;
  canViewAvailability: boolean;
  canManageOwnAvailability: boolean;
};

/**
 * Resuelve las capacidades reales del usuario para la organización activa.
 * Regla 43: Staff debe resolver permisos desde Core; no hardcodear roles.
 */
export const getStaffCapabilities = cache(
  async (organizationId: string): Promise<StaffCapabilities> => {
    const keys = [
      "agenda.view_own",
      "agenda.view_team",
      "appointment.view_service",
      "appointment.view_client_identity",
      "appointment.view_client_contact",
      "appointment.view_operational_notes",
      "appointment.reschedule",
      "appointment.cancel",
      "appointment.change_status",
      "client.view_basic",
      "client.view_contact",
      "client.team_notes.view",
      "availability.view",
      "availability.manage_own",
    ];

    try {
      const supabase = await createClient();

      const results = await Promise.all(
        keys.map(async (key) => {
          const { data } = await supabase.rpc("has_studio_capability", {
            p_organization_id: organizationId,
            p_capability_key: key,
          });
          return [key, data === true] as const;
        }),
      );

      const capMap = new Map(results);

      return {
        canViewOwnAgenda: capMap.get("agenda.view_own") ?? true, // Por defecto una profesional ve lo suyo
        canViewTeamAgenda: capMap.get("agenda.view_team") ?? false,
        canViewService: capMap.get("appointment.view_service") ?? true,
        canViewClientIdentity: capMap.get("appointment.view_client_identity") ?? true,
        canViewClientContact: capMap.get("appointment.view_client_contact") ?? false,
        canViewOperationalNotes: capMap.get("appointment.view_operational_notes") ?? true,
        canRescheduleAppointment: capMap.get("appointment.reschedule") ?? false,
        canCancelAppointment: capMap.get("appointment.cancel") ?? false,
        canChangeAppointmentStatus: capMap.get("appointment.change_status") ?? true,
        canViewClientBasic: capMap.get("client.view_basic") ?? true,
        canViewClientContactInfo: capMap.get("client.view_contact") ?? false,
        canViewTeamNotes: capMap.get("client.team_notes.view") ?? true,
        canViewAvailability: capMap.get("availability.view") ?? true,
        canManageOwnAvailability: capMap.get("availability.manage_own") ?? false,
      };
    } catch {
      // Fallback seguro: permisos mínimos para no bloquear al profesional
      return {
        canViewOwnAgenda: true,
        canViewTeamAgenda: false,
        canViewService: true,
        canViewClientIdentity: true,
        canViewClientContact: false,
        canViewOperationalNotes: true,
        canRescheduleAppointment: false,
        canCancelAppointment: false,
        canChangeAppointmentStatus: true,
        canViewClientBasic: true,
        canViewClientContactInfo: false,
        canViewTeamNotes: true,
        canViewAvailability: true,
        canManageOwnAvailability: false,
      };
    }
  },
);
