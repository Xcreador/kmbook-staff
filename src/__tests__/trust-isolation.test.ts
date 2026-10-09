import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, from }),
}));

import { getAppointmentDepositState, getClientsTrustMap, getTrustForAppointments } from "@/lib/kmbook/trust";

const visits = [{ appointmentId: "a1", clientId: "c1", status: "pending" }];

function capability(value: boolean | { error: unknown }) {
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === "has_studio_capability") {
      expect(args.p_capability_key).toBe("trust.view");
      return typeof value === "boolean" ? { data: value, error: null } : { data: null, error: value.error };
    }
    if (name === "get_studio_clients_trust") return { data: [{ client_id: "c1", color: "yellow", deposit_percent: 30 }], error: null };
    if (name === "get_studio_appointment_deposit")
      return {
        data: { has_terms: true, trust_color: "yellow", currency: "EUR", total: 100, required: 30, paid: 0, satisfied: false, deposit_pending: 30, balance_due: 100, waived: false },
        error: null,
      };
    return { data: null, error: null };
  });
}

const trustCalls = () => rpc.mock.calls.map((c) => c[0]).filter((n) => n !== "has_studio_capability");

describe("Aislamiento: sin trust.view no se llama a ningún RPC del semáforo", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
  });

  it("sin capacidad: ni clients_trust ni appointment_deposit ni lectura de tablas", async () => {
    capability(false);
    expect((await getTrustForAppointments("org", visits)).size).toBe(0);
    expect((await getClientsTrustMap("org", ["c1"])).size).toBe(0);
    expect(await getAppointmentDepositState("org", "a1")).toBeNull();
    expect(trustCalls()).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("fallo al comprobar la capacidad se trata como sin capacidad", async () => {
    capability({ error: { message: "boom" } });
    expect(await getAppointmentDepositState("org", "a1")).toBeNull();
    expect(trustCalls()).toEqual([]);
  });

  it("con capacidad: pide el semáforo y el depósito de la cita pendiente", async () => {
    capability(true);
    const map = await getTrustForAppointments("org", visits);
    expect(map.get("a1")).toEqual({ color: "yellow", pendingLabel: expect.stringContaining("30,00") });
    expect(trustCalls()).toEqual(["get_studio_clients_trust", "get_studio_appointment_deposit"]);
  });

  it("semáforo apagado (RPC vacío): no pinta nada", async () => {
    rpc.mockImplementation(async (name: string) =>
      name === "has_studio_capability" ? { data: true, error: null } : { data: [], error: null },
    );
    expect((await getTrustForAppointments("org", visits)).size).toBe(0);
  });

  it("RPC ausente (PGRST202 / 42883) degrada en silencio", async () => {
    rpc.mockImplementation(async (name: string) =>
      name === "has_studio_capability"
        ? { data: true, error: null }
        : { data: null, error: { code: name === "get_studio_clients_trust" ? "PGRST202" : "42883", message: "not found" } },
    );
    expect((await getTrustForAppointments("org", visits)).size).toBe(0);
    expect(await getAppointmentDepositState("org", "a1")).toBeNull();
  });

  it("excepción inesperada tampoco rompe la pantalla", async () => {
    rpc.mockRejectedValue(new Error("network"));
    expect((await getTrustForAppointments("org", visits)).size).toBe(0);
    expect(await getAppointmentDepositState("org", "a1")).toBeNull();
  });
});
