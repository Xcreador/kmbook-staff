import { describe, it, expect } from "vitest";
import {
  chunkClientIds,
  depositLines,
  depositPendingNotice,
  formatMoney,
  isDepositPending,
  normalizeTrustColor,
  parseAppointmentDeposit,
  parseClientsTrust,
  trustLabel,
} from "@/lib/kmbook/trust-format";
import { getHumanErrorMessage } from "@/lib/kmbook/errors";

const norm = (s: string) => s.replace(/ /g, " ");

const base = {
  has_terms: true,
  trust_color: "yellow",
  deposit_percent: 30,
  currency: "EUR",
  total: 100,
  required: 30,
  paid: 0,
  waived: false,
  waived_amount: null,
  waived_reason: null,
  satisfied: false,
  deposit_pending: 30,
  balance_due: 100,
};

describe("trust-format", () => {
  it("etiquetas accesibles por color y colores inválidos descartados", () => {
    expect(trustLabel("green")).toBe("Clienta verde");
    expect(trustLabel("yellow")).toBe("Clienta amarilla");
    expect(trustLabel("red")).toBe("Clienta roja");
    expect(normalizeTrustColor("purple")).toBeNull();
    expect(normalizeTrustColor(null)).toBeNull();
  });

  it("parsea el depósito y calcula pendiente/importes", () => {
    const d = parseAppointmentDeposit(base)!;
    expect(d.trustColor).toBe("yellow");
    expect(isDepositPending(d)).toBe(true);
    expect(norm(depositPendingNotice(d))).toBe("Depósito pendiente: 30,00 €");
    expect(depositLines(d).map((l) => l.label)).toEqual([
      "Depósito exigido",
      "Cobrado",
      "Pendiente de depósito",
      "Saldo pendiente",
    ]);
  });

  it("acepta importes como texto y motivo vacío -> null; sin trust_color -> null", () => {
    const d = parseAppointmentDeposit({ ...base, trust_color: undefined, required: "30.5", waived_reason: "  " })!;
    expect(d.trustColor).toBeNull();
    expect(d.required).toBe(30.5);
    expect(d.waivedReason).toBeNull();
  });

  it("cubierto u omitido no es pendiente; sin términos tampoco", () => {
    expect(isDepositPending(parseAppointmentDeposit({ ...base, satisfied: true, paid: 30, deposit_pending: 0 }))).toBe(false);
    expect(isDepositPending(parseAppointmentDeposit({ ...base, waived: true, satisfied: true }))).toBe(false);
    expect(isDepositPending(parseAppointmentDeposit({ ...base, has_terms: false, satisfied: false }))).toBe(false);
    expect(isDepositPending(null)).toBe(false);
  });

  it("respuestas con forma inesperada degradan a null / vacío", () => {
    expect(parseAppointmentDeposit(null)).toBeNull();
    expect(parseAppointmentDeposit([])).toBeNull();
    expect(parseAppointmentDeposit({ foo: 1 })).toBeNull();
    expect(parseClientsTrust(null)).toEqual([]);
    expect(parseClientsTrust([{ client_id: "a", color: "green" }, { client_id: "b", color: "x" }, null])).toEqual([
      { clientId: "a", color: "green" },
    ]);
  });

  it("divide ids en lotes de 500 sin duplicados ni vacíos", () => {
    const ids = Array.from({ length: 1001 }, (_, i) => `c${i}`);
    const chunks = chunkClientIds([...ids, "c0", null, undefined]);
    expect(chunks.map((c) => c.length)).toEqual([500, 500, 1]);
    expect(chunkClientIds([])).toEqual([]);
  });

  it("formatMoney tolera divisa inválida", () => {
    expect(norm(formatMoney(12.5, "EUR"))).toBe("12,50 €");
    expect(formatMoney(1, "??")).toContain("1.00");
  });

  it("errores de depósito se traducen a español humano", () => {
    const msg = "Esta cita tiene un depósito pendiente. Cobra o autoriza la excepción desde la agenda de recepción.";
    expect(getHumanErrorMessage({ code: "P0001", message: "deposit_required" })).toBe(msg);
    expect(getHumanErrorMessage({ code: "42501", message: "deposit_waive_not_allowed" })).toContain("permiso para omitir");
    expect(getHumanErrorMessage({ message: "deposit_exceeds_total" })).not.toContain("deposit_");
  });
});
