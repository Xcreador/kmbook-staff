import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  TRUST_VIEW_CAPABILITY,
  chunkClientIds,
  parseAppointmentDeposit,
  parseClientsTrust,
  isDepositPending,
  formatMoney,
  type AppointmentDeposit,
  type TrustColor,
} from "./trust-format";

/**
 * Capa de datos del semáforo de clientas y depósitos (sólo lectura).
 *
 * - Sin la capacidad `trust.view` NO se llama a ningún RPC del semáforo.
 * - Cualquier fallo o ausencia de RPC (entorno sin la migración: PGRST202 / 42883) degrada en
 *   silencio a «sin indicador». No se registra nada (privacidad: el color y los motivos no van a logs).
 */

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function canViewTrust(organizationId: string, client?: SupabaseClient): Promise<boolean> {
  try {
    const supabase = client ?? (await createClient());
    const { data, error } = await supabase.rpc("has_studio_capability", {
      p_organization_id: organizationId,
      p_capability_key: TRUST_VIEW_CAPABILITY,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

export type VisitTrust = {
  color: TrustColor | null;
  /** Importe de depósito pendiente (sólo citas pendientes con depósito sin cubrir). */
  pendingLabel: string | null;
};

async function fetchClientsTrust(
  supabase: SupabaseClient,
  organizationId: string,
  clientIds: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, TrustColor>> {
  const map = new Map<string, TrustColor>();
  try {
    for (const batch of chunkClientIds(clientIds)) {
      const { data, error } = await supabase.rpc("get_studio_clients_trust", {
        p_organization_id: organizationId,
        p_client_ids: batch,
      });
      if (error) return new Map();
      for (const row of parseClientsTrust(data)) map.set(row.clientId, row.color);
    }
  } catch {
    return new Map();
  }
  return map;
}

async function fetchAppointmentDeposit(
  supabase: SupabaseClient,
  organizationId: string,
  appointmentId: string,
): Promise<AppointmentDeposit | null> {
  try {
    const { data, error } = await supabase.rpc("get_studio_appointment_deposit", {
      p_organization_id: organizationId,
      p_appointment_id: appointmentId,
    });
    if (error) return null;
    return parseAppointmentDeposit(data);
  } catch {
    return null;
  }
}

/** Color por clienta. Vacío si no hay capacidad, el semáforo está apagado o el RPC falla. */
export async function getClientsTrustMap(
  organizationId: string,
  clientIds: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, TrustColor>> {
  if (chunkClientIds(clientIds).length === 0) return new Map();
  try {
    const supabase = await createClient();
    if (!(await canViewTrust(organizationId, supabase))) return new Map();
    return await fetchClientsTrust(supabase, organizationId, clientIds);
  } catch {
    return new Map();
  }
}

/** Estado del depósito de UNA cita. null si no hay capacidad o el RPC no está disponible. */
export async function getAppointmentDepositState(
  organizationId: string,
  appointmentId: string,
): Promise<AppointmentDeposit | null> {
  try {
    const supabase = await createClient();
    if (!(await canViewTrust(organizationId, supabase))) return null;
    return await fetchAppointmentDeposit(supabase, organizationId, appointmentId);
  } catch {
    return null;
  }
}

const MAX_DEPOSIT_LOOKUPS = 40;

/**
 * Indicadores para una lista de citas (Hoy / Agenda). Clave: appointmentId.
 * `visits` aporta el clientId (si no lo hay en la fila se resuelve desde studio_appointments por RLS).
 */
export async function getTrustForAppointments(
  organizationId: string,
  rawVisits: ReadonlyArray<{ appointmentId: string; clientId?: string | null; status: string }>,
): Promise<Map<string, VisitTrust>> {
  const result = new Map<string, VisitTrust>();
  // Una cita puede venir repetida (una fila por servicio).
  const visits = Array.from(new Map(rawVisits.map((v) => [v.appointmentId, v])).values());
  if (visits.length === 0) return result;

  try {
    const supabase = await createClient();
    if (!(await canViewTrust(organizationId, supabase))) return result;

    // Resolver clientId cuando la fuente de datos no lo trae (get_professional_day).
    const clientOf = new Map<string, string>();
    const missing: string[] = [];
    for (const v of visits) {
      if (v.clientId) clientOf.set(v.appointmentId, v.clientId);
      else missing.push(v.appointmentId);
    }
    if (missing.length > 0) {
      const { data } = await supabase
        .from("studio_appointments")
        .select("id, client_id")
        .eq("organization_id", organizationId)
        .in("id", missing);
      for (const row of data ?? []) if (row.client_id) clientOf.set(row.id, row.client_id);
    }

    const colors = await fetchClientsTrust(supabase, organizationId, Array.from(clientOf.values()));
    // Semáforo apagado (RPC vacío): no se pinta nada.
    if (colors.size === 0) return result;

    // Sólo una cita pendiente puede tener depósito sin cubrir.
    const pending = visits.filter((v) => v.status === "pending").slice(0, MAX_DEPOSIT_LOOKUPS);
    const deposits = new Map<string, AppointmentDeposit | null>();
    await Promise.all(
      pending.map(async (v) => {
        deposits.set(v.appointmentId, await fetchAppointmentDeposit(supabase, organizationId, v.appointmentId));
      }),
    );

    for (const v of visits) {
      const clientId = clientOf.get(v.appointmentId);
      const color = clientId ? (colors.get(clientId) ?? null) : null;
      const dep = deposits.get(v.appointmentId);
      const pendingLabel = dep && isDepositPending(dep) ? formatMoney(dep.depositPending, dep.currency) : null;
      if (color || pendingLabel) result.set(v.appointmentId, { color, pendingLabel });
    }
  } catch {
    return new Map();
  }
  return result;
}
