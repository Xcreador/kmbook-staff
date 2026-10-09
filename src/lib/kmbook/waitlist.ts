import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  SLOT_WINDOW_DAYS,
  addDaysToDate,
  classifyBoardError,
  countActive,
  filterToRpcStatus,
  parseCompatibleSlots,
  parseDepositQuote,
  parseWaitlistBoard,
  type BoardAccess,
  type CompatibleSlot,
  type DepositQuote,
  type WaitlistEntry,
  type WaitlistFilter,
} from "./waitlist-format";

/**
 * Capa de datos de la lista de espera. TODO sale de los RPC de Core (get_waitlist_board, …):
 * Staff no reimplementa ninguna regla ni lee las tablas de la lista (Core las cierra a RPC).
 * Sin `waitlist.operate`, Core responde `authorization_required` y la sección se oculta.
 * No se registra nada en logs (nombres, teléfonos, semáforo).
 */

export type BoardResult =
  | { access: "ok"; entries: WaitlistEntry[] }
  | { access: Exclude<BoardAccess, "ok">; entries: [] };

export async function getWaitlistBoard(organizationId: string, filter: WaitlistFilter = "all"): Promise<BoardResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_waitlist_board", {
      p_organization_id: organizationId,
      p_status: filterToRpcStatus(filter),
    });
    if (error) return { access: classifyBoardError(error), entries: [] };
    return { access: "ok", entries: parseWaitlistBoard(data) };
  } catch {
    return { access: "unavailable", entries: [] };
  }
}

/**
 * Nº de entradas activas para el indicador de la agenda. null = sin acceso o sin RPC (no se pinta nada).
 */
export async function getWaitlistActiveCount(organizationId: string): Promise<number | null> {
  const board = await getWaitlistBoard(organizationId, "active");
  return board.access === "ok" ? countActive(board.entries) : null;
}

export async function getWaitlistEntry(organizationId: string, entryId: string): Promise<{ access: BoardAccess; entry: WaitlistEntry | null }> {
  const board = await getWaitlistBoard(organizationId, "all");
  if (board.access !== "ok") return { access: board.access, entry: null };
  return { access: "ok", entry: board.entries.find((e) => e.id === entryId) ?? null };
}

export type SlotsResult = { ok: true; slots: CompatibleSlot[] } | { ok: false };

/** Huecos reales y libres de los próximos 14 días (get_waitlist_compatible_slots). */
export async function getCompatibleSlots(organizationId: string, entryId: string, fromDate: string): Promise<SlotsResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_waitlist_compatible_slots", {
      p_organization_id: organizationId,
      p_entry_id: entryId,
      p_date_from: fromDate,
      p_date_to: addDaysToDate(fromDate, SLOT_WINDOW_DAYS),
    });
    if (error) return { ok: false };
    return { ok: true, slots: parseCompatibleSlots(data) };
  } catch {
    return { ok: false };
  }
}

/**
 * Presupuesto del depósito (studio_quote_appointment_deposit). null si Core no lo da a esta usuaria:
 * entonces el formulario no ofrece omitir (can_waive desconocido) y Core decide al reservar.
 */
export async function getDepositQuote(organizationId: string, clientId: string, serviceId: string): Promise<DepositQuote | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("studio_quote_appointment_deposit", {
      p_organization_id: organizationId,
      p_client_id: clientId,
      p_service_id: serviceId,
    });
    if (error) return null;
    return parseDepositQuote(data);
  } catch {
    return null;
  }
}

export type CatalogItem = { id: string; name: string };

/** Servicios y profesionales activos para el formulario de alta (lectura por RLS de miembro). */
export async function getWaitlistCatalog(organizationId: string): Promise<{ services: CatalogItem[]; professionals: CatalogItem[] }> {
  try {
    const supabase = await createClient();
    const [servicesRes, prosRes] = await Promise.all([
      supabase.from("studio_services").select("id, name").eq("organization_id", organizationId).eq("active", true).order("name"),
      supabase.from("studio_professionals").select("id, display_name").eq("organization_id", organizationId).eq("active", true).order("display_name"),
    ]);
    return {
      services: (servicesRes.data ?? []).map((s) => ({ id: s.id, name: s.name })),
      professionals: (prosRes.data ?? []).map((p) => ({ id: p.id, name: p.display_name })),
    };
  } catch {
    return { services: [], professionals: [] };
  }
}
