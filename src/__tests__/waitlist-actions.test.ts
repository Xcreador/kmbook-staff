import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from: vi.fn() }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/kmbook/auth", () => ({ getAuthenticatedUser: async () => ({ id: "u1", email: null }) }));

import {
  addWaitlistEntryAction,
  bookWaitlistEntryAction,
  offerWaitlistSlotAction,
  updateWaitlistEntryAction,
  withdrawWaitlistOfferAction,
} from "@/app/actions/waitlist";
import { getWaitlistActiveCount, getWaitlistBoard } from "@/lib/kmbook/waitlist";

const ORG = "aaaaaaaa-0000-4000-8000-00000000000a";
const ENTRY = "bbbbbbbb-0000-4000-8000-00000000000b";
const CLIENT = "cccccccc-0000-4000-8000-00000000000c";
const SERVICE = "dddddddd-0000-4000-8000-00000000000d";
const PRO = "eeeeeeee-0000-4000-8000-00000000000e";
const AT = "2026-10-12T09:00:00Z";
const base = { depositAmount: null, method: null, provider: null, reference: null, waive: false, waiveReason: null };
const KEY = "wl-book-12345678";

const names = () => rpc.mock.calls.map((c) => c[0]);

describe("Acciones de lista de espera", () => {
  beforeEach(() => rpc.mockReset());

  it("update_waitlist_entry rechaza «booked» sin llamar a Core", async () => {
    const res = await updateWaitlistEntryAction(ORG, ENTRY, {
      professionalId: null, days: [], timeFrom: null, timeTo: null, notes: null,
      status: "booked" as unknown as "active",
    });
    expect(res.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("update_waitlist_entry traduce el error de Core", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "waitlist_booked_requires_appointment" } });
    const res = await updateWaitlistEntryAction(ORG, ENTRY, { professionalId: null, days: [1], timeFrom: "09:00", timeTo: "12:00", notes: null, status: "contacted" });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/cita confirmada/);
    expect(rpc).toHaveBeenCalledWith("update_waitlist_entry", expect.objectContaining({ p_status: "contacted", p_preferred_days: [1] }));
  });

  it("add_waitlist_entry valida franja y llama al RPC", async () => {
    rpc.mockResolvedValue({ data: ENTRY, error: null });
    const bad = await addWaitlistEntryAction(ORG, { clientId: CLIENT, serviceId: SERVICE, professionalId: null, days: [], timeFrom: "13:00", timeTo: "09:00", notes: null });
    expect(bad.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    const ok = await addWaitlistEntryAction(ORG, { clientId: CLIENT, serviceId: SERVICE, professionalId: PRO, days: [1], timeFrom: "09:00", timeTo: "13:00", notes: " hola " });
    expect(ok).toMatchObject({ success: true, entryId: ENTRY });
    expect(rpc).toHaveBeenCalledWith("add_waitlist_entry", expect.objectContaining({ p_notes: "hola", p_preferred_professional_id: PRO }));
  });

  it("ofrecer hueco: errores de Core en español", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23P01", message: "slot_unavailable" } });
    const res = await offerWaitlistSlotAction(ORG, ENTRY, PRO, AT);
    expect(res.success).toBe(false);
    expect(res.message).toBe("Ese hueco ya no está disponible. Elige otro.");
    expect((await offerWaitlistSlotAction(ORG, ENTRY, "no-uuid", AT)).success).toBe(false);
  });

  it("retirar oferta llama a withdraw_waitlist_offer", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const res = await withdrawWaitlistOfferAction(ORG, ENTRY, "ffffffff-0000-4000-8000-00000000000f");
    expect(res.success).toBe(true);
    expect(names()).toEqual(["withdraw_waitlist_offer"]);
  });

  describe("book_waitlist_entry", () => {
    const answer = (quote: unknown, book: unknown = { data: { appointment_id: "a1", status: "pending", entry_status: "contacted", deposit_pending: 12, currency: "EUR", satisfied: false }, error: null }) =>
      rpc.mockImplementation(async (name: string) =>
        name === "studio_quote_appointment_deposit" ? { data: quote, error: null } : book,
      );

    it("omitir sin can_waive de Core: no llega a book_waitlist_entry", async () => {
      answer({ enabled: true, total: 40, required: 12, can_waive: false, can_record: true });
      const res = await bookWaitlistEntryAction(ORG, ENTRY, CLIENT, SERVICE, PRO, AT, { ...base, waive: true, waiveReason: "motivo válido" }, KEY);
      expect(res.success).toBe(false);
      expect(names()).not.toContain("book_waitlist_entry");
    });

    it("omitir con can_waive pero sin motivo: no llega a Core", async () => {
      answer({ enabled: true, total: 40, required: 12, can_waive: true, can_record: true });
      const res = await bookWaitlistEntryAction(ORG, ENTRY, CLIENT, SERVICE, PRO, AT, { ...base, waive: true, waiveReason: "abc" }, KEY);
      expect(res.success).toBe(false);
      expect(names()).not.toContain("book_waitlist_entry");
    });

    it("omitir con can_waive y motivo: envía waive y la clave", async () => {
      answer({ enabled: true, total: 40, required: 12, can_waive: true, can_record: true }, { data: { appointment_id: "a1", status: "confirmed", entry_status: "booked", satisfied: true }, error: null });
      const res = await bookWaitlistEntryAction(ORG, ENTRY, CLIENT, SERVICE, PRO, AT, { ...base, waive: true, waiveReason: "motivo válido" }, KEY);
      expect(res).toMatchObject({ success: true, appointmentId: "a1", appointmentStatus: "confirmed" });
      expect(rpc).toHaveBeenCalledWith("book_waitlist_entry", expect.objectContaining({ p_waive: true, p_waive_reason: "motivo válido", p_idempotency_key: KEY, p_deposit_amount: null }));
    });

    it("sin cobro ni omisión: cita pendiente y mensaje claro; no consulta el presupuesto", async () => {
      answer(null);
      const res = await bookWaitlistEntryAction(ORG, ENTRY, CLIENT, SERVICE, PRO, AT, base, KEY);
      expect(res.success).toBe(true);
      expect(res.appointmentStatus).toBe("pending");
      expect(res.message).toContain("La reserva no se confirma hasta cubrir el depósito.");
      expect(names()).toEqual(["book_waitlist_entry"]);
    });

    it("cobro con TPV: envía importe y método", async () => {
      answer(null);
      await bookWaitlistEntryAction(ORG, ENTRY, CLIENT, SERVICE, PRO, AT, { ...base, depositAmount: 12, method: "card_terminal" }, KEY);
      expect(rpc).toHaveBeenCalledWith("book_waitlist_entry", expect.objectContaining({ p_deposit_amount: 12, p_deposit_method: "card_terminal", p_waive: false }));
    });

    it("rechaza una clave de idempotencia inválida y errores de Core llegan en español", async () => {
      expect((await bookWaitlistEntryAction(ORG, ENTRY, CLIENT, SERVICE, PRO, AT, base, "corta")).success).toBe(false);
      expect(rpc).not.toHaveBeenCalled();
      answer(null, { data: null, error: { code: "42501", message: "deposit_waive_not_allowed" } });
      const res = await bookWaitlistEntryAction(ORG, ENTRY, CLIENT, SERVICE, PRO, AT, base, KEY);
      expect(res.message).toMatch(/permiso para omitir/);
    });

    it("la misma clave se reenvía tal cual en un reintento", async () => {
      answer(null);
      await bookWaitlistEntryAction(ORG, ENTRY, CLIENT, SERVICE, PRO, AT, base, KEY);
      await bookWaitlistEntryAction(ORG, ENTRY, CLIENT, SERVICE, PRO, AT, base, KEY);
      const keys = rpc.mock.calls.filter((c) => c[0] === "book_waitlist_entry").map((c) => c[1].p_idempotency_key);
      expect(keys).toEqual([KEY, KEY]);
    });
  });
});

describe("Permisos del tablero", () => {
  beforeEach(() => rpc.mockReset());

  it("authorization_required: sección oculta, sin lanzar", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "authorization_required" } });
    expect(await getWaitlistBoard(ORG)).toEqual({ access: "forbidden", entries: [] });
    expect(await getWaitlistActiveCount(ORG)).toBeNull();
  });

  it("RPC ausente o fallo: no disponible, sin romper", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "x" } });
    expect((await getWaitlistBoard(ORG)).access).toBe("unavailable");
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await getWaitlistBoard(ORG);
    expect(result.access).toBe("unavailable");
  });

  it("con acceso: cuenta las activas y pasa el filtro de estado", async () => {
    rpc.mockResolvedValue({ data: [
      { id: "e1", client_id: "c", service_id: "s", status: "active" },
      { id: "e2", client_id: "c", service_id: "s", status: "active" },
    ], error: null });
    expect(await getWaitlistActiveCount(ORG)).toBe(2);
    expect(rpc).toHaveBeenCalledWith("get_waitlist_board", { p_organization_id: ORG, p_status: "active" });
  });
});
