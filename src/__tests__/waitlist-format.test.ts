import { describe, it, expect } from "vitest";
import {
  BOOK_PENDING_TEXT,
  addDaysToDate,
  bookOutcomeMessage,
  buildBookRpcArgs,
  classifyBoardError,
  countActive,
  countdownLabel,
  daysLabel,
  filterToRpcStatus,
  groupSlots,
  newIdempotencyKey,
  parseBookResult,
  parseCompatibleSlots,
  parseDepositQuote,
  parseFilter,
  parseWaitlistBoard,
  validateBookInput,
  validatePreferences,
  SETTABLE_STATUSES,
  DEPOSIT_METHODS,
} from "@/lib/kmbook/waitlist-format";
import { getHumanErrorMessage } from "@/lib/kmbook/errors";

const row = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  client_id: "c1",
  client_name: "Ana Pérez",
  client_phone: "600000000",
  service_id: "s1",
  service_name: "Manicura",
  service_duration: 60,
  service_price: 40,
  currency: "EUR",
  location_id: "l1",
  preferred_professional_id: "p1",
  preferred_professional_name: "Laura",
  preferred_days: [1, 3],
  preferred_time_from: "09:00:00",
  preferred_time_to: "13:00:00",
  status: "active",
  source: "online",
  notes: "Prefiere mañanas",
  created_at: "2026-10-09T08:00:00Z",
  position: 2,
  offer: null,
  appointment: null,
  ...over,
});

describe("Lista de espera — parseo del tablero", () => {
  it("mapea una entrada completa", () => {
    const [e] = parseWaitlistBoard([row()]);
    expect(e).toMatchObject({
      id: "e1",
      clientName: "Ana Pérez",
      serviceName: "Manicura",
      preferredProfessionalName: "Laura",
      preferredDays: [1, 3],
      timeFrom: "09:00",
      timeTo: "13:00",
      status: "active",
      source: "online",
      position: 2,
    });
  });

  it("sin trust_color / deposit_percent NO hay color ni porcentaje", () => {
    const [e] = parseWaitlistBoard([row()]);
    expect(e.trustColor).toBeNull();
    expect(e.depositPercent).toBeNull();
  });

  it("con trust_color de Core lo conserva; un valor desconocido se descarta", () => {
    const [ok] = parseWaitlistBoard([row({ trust_color: "yellow", deposit_percent: 30 })]);
    expect(ok.trustColor).toBe("yellow");
    expect(ok.depositPercent).toBe(30);
    const [bad] = parseWaitlistBoard([row({ trust_color: "purple" })]);
    expect(bad.trustColor).toBeNull();
  });

  it("mapea la oferta vigente y la cita vinculada", () => {
    const [e] = parseWaitlistBoard([
      row({
        status: "contacted",
        position: null,
        offer: { id: "o1", status: "pending", starts_at: "2026-10-12T09:00:00Z", ends_at: "2026-10-12T10:00:00Z", expires_at: "2026-10-11T09:00:00Z", professional_id: "p1", professional_name: "Laura", origin: "auto" },
        appointment: { id: "a1", status: "pending", starts_at: "2026-10-12T09:00:00Z" },
      }),
    ]);
    expect(e.offer).toMatchObject({ id: "o1", origin: "auto", professionalName: "Laura" });
    expect(e.appointment).toEqual({ id: "a1", status: "pending", startsAt: "2026-10-12T09:00:00Z" });
    expect(e.position).toBeNull();
  });

  it("la posición sólo existe en entradas activas", () => {
    const [e] = parseWaitlistBoard([row({ status: "removed", position: 3 })]);
    expect(e.position).toBeNull();
  });

  it("descarta filas inválidas y respuestas que no son lista", () => {
    expect(parseWaitlistBoard([{ id: "x" }, null, 5, row({ status: "weird" })])).toEqual([]);
    expect(parseWaitlistBoard(null)).toEqual([]);
    expect(parseWaitlistBoard({})).toEqual([]);
  });

  it("cuenta sólo las activas", () => {
    const entries = parseWaitlistBoard([row(), row({ id: "e2", status: "contacted" }), row({ id: "e3", status: "booked" })]);
    expect(countActive(entries)).toBe(1);
  });

  it("filtros: valor desconocido = todas; el RPC recibe null para «todas»", () => {
    expect(parseFilter("nada")).toBe("all");
    expect(parseFilter("contacted")).toBe("contacted");
    expect(parseFilter(["active", "x"])).toBe("active");
    expect(filterToRpcStatus("all")).toBeNull();
    expect(filterToRpcStatus("booked")).toBe("booked");
  });

  it("días y franja en español", () => {
    expect(daysLabel([])).toBe("Cualquier día");
    expect(daysLabel([0, 1])).toBe("Lun, Dom");
  });
});

describe("Lista de espera — acceso", () => {
  it("authorization_required = sin acceso; otro fallo / RPC ausente = no disponible", () => {
    expect(classifyBoardError({ code: "42501", message: "authorization_required" })).toBe("forbidden");
    expect(classifyBoardError({ code: "PGRST202", message: "not found" })).toBe("unavailable");
    expect(classifyBoardError(new Error("boom"))).toBe("unavailable");
    expect(classifyBoardError({ code: "42501", message: "authentication_required" })).toBe("unavailable");
  });
});

describe("Lista de espera — cuenta atrás", () => {
  const now = Date.parse("2026-10-09T10:00:00Z");
  it("formatea horas, minutos y caducada", () => {
    expect(countdownLabel("2026-10-09T12:05:00Z", now)).toBe("Caduca en 2 h 05 min");
    expect(countdownLabel("2026-10-09T10:12:00Z", now)).toBe("Caduca en 12 min");
    expect(countdownLabel("2026-10-09T09:00:00Z", now)).toBe("Caducada");
    expect(countdownLabel("2026-10-12T10:00:00Z", now)).toBe("Caduca en 3 días");
    expect(countdownLabel("no-date", now)).toBe("Caducidad desconocida");
  });
});

describe("Lista de espera — huecos compatibles", () => {
  const slot = (date: string, time: string, pro: string, name: string) => ({
    slot_date: date,
    slot_time: `${time}:00`,
    slot_start: `${date}T${time}:00Z`,
    slot_end: `${date}T${time}:59Z`,
    professional_id: pro,
    professional_name: name,
  });
  it("parsea y agrupa por día y profesional en orden cronológico", () => {
    const slots = parseCompatibleSlots([
      slot("2026-10-13", "10:00", "p2", "Marta"),
      slot("2026-10-12", "11:00", "p1", "Laura"),
      slot("2026-10-12", "09:00", "p1", "Laura"),
      slot("2026-10-12", "09:30", "p2", "Marta"),
      { slot_date: "2026-10-12" },
    ]);
    expect(slots).toHaveLength(4);
    const groups = groupSlots(slots);
    expect(groups.map((g) => g.date)).toEqual(["2026-10-12", "2026-10-13"]);
    expect(groups[0].professionals.map((p) => p.professionalName)).toEqual(["Laura", "Marta"]);
    expect(groups[0].professionals[0].slots.map((s) => s.time)).toEqual(["09:00", "11:00"]);
  });
  it("ventana de 14 días", () => {
    expect(addDaysToDate("2026-10-09", 14)).toBe("2026-10-23");
    expect(addDaysToDate("2026-12-25", 14)).toBe("2027-01-08");
  });
});

describe("Lista de espera — estados editables", () => {
  it("nunca se ofrece «booked» como estado manual", () => {
    expect(SETTABLE_STATUSES).toEqual(["active", "contacted", "removed"]);
    expect((SETTABLE_STATUSES as readonly string[]).includes("booked")).toBe(false);
  });
  it("valida la franja horaria y las notas", () => {
    expect(validatePreferences({ days: [], timeFrom: "13:00", timeTo: "09:00", notes: null }).ok).toBe(false);
    expect(validatePreferences({ days: [], timeFrom: "09:00", timeTo: "13:00", notes: null }).ok).toBe(true);
    expect(validatePreferences({ days: [], timeFrom: null, timeTo: null, notes: "x".repeat(501) }).ok).toBe(false);
  });
});

describe("Lista de espera — depósito al convertir", () => {
  const base = { depositAmount: null, method: null, provider: null, reference: null, waive: false, waiveReason: null };

  it("métodos: exactamente los del TPV de Core (sin card_online)", () => {
    expect(DEPOSIT_METHODS.map((m) => m.value)).toEqual(["cash", "card_terminal", "bank_transfer", "bizum", "other"]);
  });

  it("omitir sólo con can_waive de Core", () => {
    const input = { ...base, waive: true, waiveReason: "Clienta de confianza" };
    expect(validateBookInput(input, { canWaive: false }).ok).toBe(false);
    expect(validateBookInput(input, { canWaive: true }).ok).toBe(true);
  });

  it("omitir exige motivo de al menos 5 caracteres", () => {
    for (const reason of [null, "", "  ", "abcd", "  ab  "]) {
      const r = validateBookInput({ ...base, waive: true, waiveReason: reason }, { canWaive: true });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("reason");
    }
    expect(validateBookInput({ ...base, waive: true, waiveReason: "abcde" }, { canWaive: true }).ok).toBe(true);
  });

  it("no se puede omitir y cobrar a la vez", () => {
    expect(validateBookInput({ ...base, waive: true, waiveReason: "motivo ok", depositAmount: 10 }, { canWaive: true }).ok).toBe(false);
  });

  it("cobro: exige método válido; «otro» exige medio de pago", () => {
    expect(validateBookInput({ ...base, depositAmount: 20 }, { canWaive: false }).ok).toBe(false);
    expect(validateBookInput({ ...base, depositAmount: 20, method: "card_online" }, { canWaive: false }).ok).toBe(false);
    expect(validateBookInput({ ...base, depositAmount: 20, method: "cash" }, { canWaive: false }).ok).toBe(true);
    expect(validateBookInput({ ...base, depositAmount: 20, method: "other" }, { canWaive: false }).ok).toBe(false);
    expect(validateBookInput({ ...base, depositAmount: 20, method: "other", provider: "Datafono B" }, { canWaive: false }).ok).toBe(false);
    expect(validateBookInput({ ...base, depositAmount: 20, method: "other", provider: "datafono_b" }, { canWaive: false }).ok).toBe(true);
    expect(validateBookInput({ ...base, depositAmount: -5, method: "cash" }, { canWaive: false }).ok).toBe(false);
  });

  it("sin cobro ni omisión es válido: la cita queda pendiente", () => {
    expect(validateBookInput(base, { canWaive: false }).ok).toBe(true);
    expect(bookOutcomeMessage({ appointmentId: "a", appointmentStatus: "pending", entryStatus: "contacted", replayed: false, depositPending: 20, currency: "EUR", satisfied: false })).toContain(BOOK_PENDING_TEXT);
  });

  it("argumentos del RPC: sin cobro no se envía método; omitir envía el motivo recortado", () => {
    const pending = buildBookRpcArgs({ ...base, method: "cash", provider: "x" }, "wl-book-12345678");
    expect(pending).toMatchObject({ p_deposit_amount: null, p_deposit_method: null, p_deposit_provider: null, p_waive: false, p_waive_reason: null, p_idempotency_key: "wl-book-12345678" });
    const waived = buildBookRpcArgs({ ...base, waive: true, waiveReason: "  motivo válido  " }, "k-12345678");
    expect(waived).toMatchObject({ p_waive: true, p_waive_reason: "motivo válido", p_deposit_amount: null });
    const paid = buildBookRpcArgs({ ...base, depositAmount: 20, method: "other", provider: "datafono_b", reference: " R1 " }, "k-12345678");
    expect(paid).toMatchObject({ p_deposit_amount: 20, p_deposit_method: "other", p_deposit_provider: "datafono_b", p_deposit_reference: "R1", p_waive: false });
    const cash = buildBookRpcArgs({ ...base, depositAmount: 20, method: "cash", provider: "ignorado" }, "k-12345678");
    expect(cash.p_deposit_provider).toBeNull();
  });

  it("clave de idempotencia: válida para Core (8..200) y distinta por formulario", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a.length).toBeLessThanOrEqual(200);
    expect(a).not.toBe(b);
  });

  it("parsea el presupuesto de Core; el color sólo si viene", () => {
    const q = parseDepositQuote({ enabled: true, total: 40, currency: "EUR", deposit_percent: 30, required: 12, color: "yellow", can_waive: true, can_record: true });
    expect(q).toMatchObject({ enabled: true, required: 12, color: "yellow", canWaive: true, canRecord: true });
    const noColor = parseDepositQuote({ enabled: true, total: 40, deposit_percent: 30, required: 12, color: null, can_waive: false, can_record: false });
    expect(noColor?.color).toBeNull();
    expect(noColor?.canWaive).toBe(false);
    expect(parseDepositQuote(null)).toBeNull();
    expect(parseDepositQuote({ total: 1 })).toBeNull();
  });

  it("parsea el resultado de book_waitlist_entry", () => {
    const r = parseBookResult({ appointment_id: "a1", status: "pending", entry_status: "contacted", replayed: false, deposit_pending: 12, currency: "EUR", satisfied: false });
    expect(r).toMatchObject({ appointmentId: "a1", appointmentStatus: "pending", entryStatus: "contacted", depositPending: 12 });
    expect(parseBookResult({})).toBeNull();
  });
});

describe("Lista de espera — mensajes de error de Core en español", () => {
  const cases: Array<[string, RegExp]> = [
    ["deposit_waive_not_allowed", /permiso para omitir/],
    ["waive_reason_required", /motivo.*5 caracteres/],
    ["slot_unavailable", /hueco ya no está disponible/],
    ["slot_too_soon", /demasiado pronto/],
    ["waitlist_entry_not_active", /ya no está en la cola/],
    ["deposit_exceeds_total", /no puede superar el total/],
    ["deposit_not_required", /no exige depósito/],
    ["deposit_payment_method_required", /Elige cómo/],
    ["waitlist_booked_requires_appointment", /cita confirmada/],
    ["waitlist_disabled", /no está activada/],
    ["waitlist_offer_not_pending", /ya no está vigente/],
    ["professional_not_compatible", /no es compatible/],
  ];
  it.each(cases)("%s", (code, pattern) => {
    const msg = getHumanErrorMessage({ code: "P0001", message: code });
    expect(msg).toMatch(pattern);
    expect(msg).not.toContain(code);
  });
  it("authorization_required sigue siendo «sin permiso»", () => {
    expect(getHumanErrorMessage({ code: "42501", message: "authorization_required" })).toBe("No tienes permiso para realizar esta acción.");
  });
});
