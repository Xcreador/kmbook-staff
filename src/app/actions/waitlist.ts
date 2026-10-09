"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/kmbook/auth";
import { createClient } from "@/lib/supabase/server";
import { getHumanErrorMessage } from "@/lib/kmbook/errors";
import {
  SETTABLE_STATUSES,
  UUID_PATTERN,
  buildBookRpcArgs,
  normalizeDays,
  normalizeTime,
  parseBookResult,
  validateBookInput,
  validatePreferences,
  bookOutcomeMessage,
  parseDepositQuote,
  type BookInput,
  type SettableStatus,
} from "@/lib/kmbook/waitlist-format";

/**
 * Server actions de la lista de espera. Toda la lógica vive en los RPC de Core; aquí sólo se comprueba
 * la forma de la entrada (UX) y se traducen los errores. Core vuelve a validar y manda.
 */

export type WaitlistActionResult = {
  success: boolean;
  message: string;
  entryId?: string;
  appointmentId?: string;
  appointmentStatus?: string;
};

const SESSION_EXPIRED: WaitlistActionResult = { success: false, message: "Tu sesión ha caducado. Vuelve a iniciar sesión." };

function fail(message: string): WaitlistActionResult {
  return { success: false, message };
}

function isId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function refresh(entryId?: string) {
  revalidatePath("/waitlist");
  revalidatePath("/agenda");
  revalidatePath("/today");
  if (entryId) revalidatePath(`/waitlist/${entryId}`);
}

export type ClientSearchResult = { id: string; name: string; phone: string | null };

export async function searchClientsAction(
  organizationId: string,
  query: string,
): Promise<{ success: boolean; message: string; clients: ClientSearchResult[] }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ...SESSION_EXPIRED, clients: [] };
  const q = (query ?? "").trim();
  if (!isId(organizationId) || q.length < 2) return { success: true, message: "", clients: [] };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_studio_clients_for_booking", {
      p_organization_id: organizationId,
      p_search: q.slice(0, 100),
      p_limit: 10,
      p_offset: 0,
    });
    if (error) return { success: false, message: getHumanErrorMessage(error), clients: [] };
    return {
      success: true,
      message: "",
      clients: (data ?? []).map((c) => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`.trim(),
        phone: c.phone,
      })),
    };
  } catch (err) {
    return { success: false, message: getHumanErrorMessage(err), clients: [] };
  }
}

export type AddEntryInput = {
  clientId: string;
  serviceId: string;
  professionalId: string | null;
  days: number[];
  timeFrom: string | null;
  timeTo: string | null;
  notes: string | null;
};

export async function addWaitlistEntryAction(organizationId: string, input: AddEntryInput): Promise<WaitlistActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return SESSION_EXPIRED;
  if (!isId(organizationId) || !isId(input.clientId)) return fail("Elige la clienta.");
  if (!isId(input.serviceId)) return fail("Elige el servicio.");
  if (input.professionalId !== null && !isId(input.professionalId)) return fail("Profesional no válida.");

  const prefs = {
    days: normalizeDays(input.days),
    timeFrom: normalizeTime(input.timeFrom),
    timeTo: normalizeTime(input.timeTo),
    notes: input.notes?.trim() || null,
  };
  const valid = validatePreferences(prefs);
  if (!valid.ok) return fail(valid.message);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("add_waitlist_entry", {
      p_organization_id: organizationId,
      p_client_id: input.clientId,
      p_service_id: input.serviceId,
      p_preferred_professional_id: input.professionalId,
      p_preferred_days: prefs.days,
      p_preferred_time_from: prefs.timeFrom,
      p_preferred_time_to: prefs.timeTo,
      p_notes: prefs.notes,
    });
    if (error) return fail(getHumanErrorMessage(error));
    refresh();
    return { success: true, message: "Clienta añadida a la lista de espera.", entryId: typeof data === "string" ? data : undefined };
  } catch (err) {
    return fail(getHumanErrorMessage(err));
  }
}

export type UpdateEntryInput = {
  professionalId: string | null;
  days: number[];
  timeFrom: string | null;
  timeTo: string | null;
  notes: string | null;
  /** active | contacted | removed. «booked» no existe aquí: lo fija Core al confirmarse la cita. */
  status: SettableStatus;
};

export async function updateWaitlistEntryAction(organizationId: string, entryId: string, input: UpdateEntryInput): Promise<WaitlistActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return SESSION_EXPIRED;
  if (!isId(organizationId) || !isId(entryId)) return fail("Entrada no válida.");
  if (!(SETTABLE_STATUSES as readonly string[]).includes(input.status)) {
    return fail("Una entrada solo pasa a reservada cuando existe una cita confirmada.");
  }
  if (input.professionalId !== null && !isId(input.professionalId)) return fail("Profesional no válida.");

  const prefs = {
    days: normalizeDays(input.days),
    timeFrom: normalizeTime(input.timeFrom),
    timeTo: normalizeTime(input.timeTo),
    notes: input.notes?.trim() || null,
  };
  const valid = validatePreferences(prefs);
  if (!valid.ok) return fail(valid.message);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_waitlist_entry", {
      p_organization_id: organizationId,
      p_entry_id: entryId,
      p_preferred_professional_id: input.professionalId,
      p_preferred_days: prefs.days,
      p_preferred_time_from: prefs.timeFrom,
      p_preferred_time_to: prefs.timeTo,
      p_notes: prefs.notes,
      p_status: input.status,
    });
    if (error) return fail(getHumanErrorMessage(error));
    refresh(entryId);
    return { success: true, message: "Entrada actualizada.", entryId };
  } catch (err) {
    return fail(getHumanErrorMessage(err));
  }
}

export async function removeWaitlistEntryAction(organizationId: string, entryId: string): Promise<WaitlistActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return SESSION_EXPIRED;
  if (!isId(organizationId) || !isId(entryId)) return fail("Entrada no válida.");
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_waitlist_entry", { p_organization_id: organizationId, p_entry_id: entryId });
    if (error) return fail(getHumanErrorMessage(error));
    refresh(entryId);
    return { success: true, message: "Clienta retirada de la lista de espera.", entryId };
  } catch (err) {
    return fail(getHumanErrorMessage(err));
  }
}

export async function offerWaitlistSlotAction(
  organizationId: string,
  entryId: string,
  professionalId: string,
  startsAt: string,
): Promise<WaitlistActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return SESSION_EXPIRED;
  if (!isId(organizationId) || !isId(entryId) || !isId(professionalId) || Number.isNaN(Date.parse(startsAt))) {
    return fail("Hueco no válido.");
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("offer_waitlist_slot", {
      p_organization_id: organizationId,
      p_entry_id: entryId,
      p_professional_id: professionalId,
      p_starts_at: startsAt,
    });
    if (error) return fail(getHumanErrorMessage(error));
    refresh(entryId);
    return { success: true, message: "Hueco ofrecido. La oferta caduca automáticamente.", entryId };
  } catch (err) {
    return fail(getHumanErrorMessage(err));
  }
}

export async function withdrawWaitlistOfferAction(
  organizationId: string,
  entryId: string,
  offerId: string,
  reason?: string,
): Promise<WaitlistActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return SESSION_EXPIRED;
  if (!isId(organizationId) || !isId(offerId)) return fail("Oferta no válida.");
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("withdraw_waitlist_offer", {
      p_organization_id: organizationId,
      p_offer_id: offerId,
      p_reason: reason?.trim() || null,
    });
    if (error) return fail(getHumanErrorMessage(error));
    refresh(entryId);
    return { success: true, message: "Oferta retirada. El hueco pasa a la siguiente clienta compatible.", entryId };
  } catch (err) {
    return fail(getHumanErrorMessage(err));
  }
}

/**
 * Convierte la entrada en una reserva real (book_waitlist_entry).
 * `canWaive` NO se confía al cliente: se vuelve a pedir a Core (studio_quote_appointment_deposit) antes de
 * enviar una omisión, y Core la rechaza igualmente sin `deposit.waive`.
 */
export async function bookWaitlistEntryAction(
  organizationId: string,
  entryId: string,
  clientId: string,
  serviceId: string,
  professionalId: string,
  startsAt: string,
  input: BookInput,
  idempotencyKey: string,
): Promise<WaitlistActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return SESSION_EXPIRED;
  if (!isId(organizationId) || !isId(entryId) || !isId(professionalId) || Number.isNaN(Date.parse(startsAt))) {
    return fail("Hueco no válido.");
  }
  if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    return fail("No se pudo identificar el intento. Recarga la página e inténtalo de nuevo.");
  }

  try {
    const supabase = await createClient();

    let canWaive = false;
    if (input.waive) {
      if (!isId(clientId) || !isId(serviceId)) return fail("Reserva no válida.");
      const { data, error } = await supabase.rpc("studio_quote_appointment_deposit", {
        p_organization_id: organizationId,
        p_client_id: clientId,
        p_service_id: serviceId,
      });
      canWaive = !error && parseDepositQuote(data)?.canWaive === true;
    }
    const valid = validateBookInput(input, { canWaive });
    if (!valid.ok) return fail(valid.message);

    const { data, error } = await supabase.rpc("book_waitlist_entry", {
      p_organization_id: organizationId,
      p_entry_id: entryId,
      p_professional_id: professionalId,
      p_starts_at: startsAt,
      ...buildBookRpcArgs(input, idempotencyKey),
    });
    if (error) return fail(getHumanErrorMessage(error));

    const outcome = parseBookResult(data);
    refresh(entryId);
    if (!outcome) return { success: true, message: "Reserva creada. Comprueba su estado en la agenda.", entryId };
    return {
      success: true,
      message: bookOutcomeMessage(outcome),
      entryId,
      appointmentId: outcome.appointmentId,
      appointmentStatus: outcome.appointmentStatus,
    };
  } catch (err) {
    return fail(getHumanErrorMessage(err));
  }
}
