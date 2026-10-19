import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, from }),
}));
vi.mock("@/lib/kmbook/capabilities", () => ({
  getStaffCapabilities: async () => ({
    canRescheduleAppointment: false,
    canCancelAppointment: false,
    canChangeAppointmentStatus: true,
  }),
}));

import { classifyDetailError, getAppointmentDetail } from "@/lib/kmbook/appointments";

const APPT = "8b6f6d2e-1c1a-4a64-9d4c-2f3c8a1b7e10";

const detailRow = (over: Record<string, unknown> = {}) => ({
  appointment_id: APPT,
  organization_id: "org",
  location_id: "loc",
  location_name: "Centro",
  client_id: "cli",
  status: "confirmed",
  starts_at: "2031-01-06T09:00:00Z",
  ends_at: "2031-01-06T11:00:00Z",
  client_name: null,
  client_phone: null,
  client_team_notes: null,
  operational_notes: "Alergia al látex",
  cancellation_reason: null,
  items: [
    { item_id: "i1", service_id: "s1", professional_id: "p1", service_name: "Manicura", professional_name: "Bárbara", duration_minutes: 60, actual_started_at: null, actual_finished_at: null, actual_duration_seconds: null },
    { item_id: "i2", service_id: "s2", professional_id: "p1", service_name: "Pedicura", professional_name: "Bárbara", duration_minutes: 60, actual_started_at: null, actual_finished_at: null, actual_duration_seconds: null },
  ],
  ...over,
});

function mockRpc(detail: { data?: unknown; error?: unknown }) {
  rpc.mockImplementation(async (name: string) => {
    if (name === "get_studio_appointment_detail") return { data: detail.data ?? null, error: detail.error ?? null };
    if (name === "get_studio_client_notices") return { data: [{ notice: "Prefiere sin conversación" }], error: null };
    return { data: null, error: null };
  });
}

describe("ST-01 — detalle de cita vía RPC", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
  });

  it("cita propia con varios servicios, observaciones y aviso importante", async () => {
    mockRpc({ data: detailRow() });
    const r = await getAppointmentDetail("org", APPT);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.appointment.items).toHaveLength(2);
    expect(r.appointment.operationalNotes).toBe("Alergia al látex");
    expect(r.appointment.importantNotice).toBe("Prefiere sin conversación");
    expect(r.appointment.clientName).toBe("Clienta");
    expect(r.appointment.clientPhone).toBeNull();
  });

  it("nunca lee las tablas de citas directamente (SELECT retirado en RBAC V2)", async () => {
    mockRpc({ data: detailRow() });
    await getAppointmentDetail("org", APPT);
    expect(from).not.toHaveBeenCalled();
  });

  it("cita cancelada se muestra, sin acciones de ejecución", async () => {
    mockRpc({ data: detailRow({ status: "cancelled", cancellation_reason: "Cliente" }) });
    const r = await getAppointmentDetail("org", APPT);
    expect(r.kind === "ok" && r.appointment.canOperate).toBe(false);
    expect(r.kind === "ok" && r.appointment.items.every((i) => !i.isExecutable)).toBe(true);
  });

  it("inexistente, ajena, sesión caducada y error se distinguen", async () => {
    mockRpc({ error: { code: "P0002", message: "appointment_not_found" } });
    expect((await getAppointmentDetail("org", APPT)).kind).toBe("not_found");
    mockRpc({ error: { code: "42501", message: "appointment_forbidden" } });
    expect((await getAppointmentDetail("org", APPT)).kind).toBe("forbidden");
    mockRpc({ error: { code: "42501", message: "authentication_required" } });
    expect((await getAppointmentDetail("org", APPT)).kind).toBe("session_expired");
    mockRpc({ error: { code: "PGRST202", message: "function not found" } });
    expect((await getAppointmentDetail("org", APPT)).kind).toBe("error");
  });

  it("un fallo del servidor no se presenta como «no existe»", () => {
    expect(classifyDetailError({ code: "XX000", message: "boom" }).kind).toBe("error");
  });

  it("un id manipulado que no es UUID no llega a la base de datos", async () => {
    mockRpc({ data: detailRow() });
    expect((await getAppointmentDetail("org", "../../etc")).kind).toBe("not_found");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("ST-04 — «Mi horario» eliminado de Staff", () => {
  const root = join(__dirname, "..", "..");
  const read = (p: string) => readFileSync(join(root, p), "utf8");

  it("no existe la pantalla ni su servicio", () => {
    expect(existsSync(join(root, "src/app/schedule/page.tsx"))).toBe(false);
    expect(existsSync(join(root, "src/lib/kmbook/schedule.ts"))).toBe(false);
  });

  it("el perfil no enlaza al horario ni muestra la tarjeta de planificación", () => {
    const profile = read("src/app/profile/page.tsx");
    expect(profile).not.toContain("/schedule");
    expect(profile).not.toContain("PLANIFICACIÓN Y AUSENCIAS");
  });

  it("la ruta antigua redirige a Mi jornada sin bucle", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toContain('source: "/schedule"');
    expect(cfg).toContain('destination: "/today"');
  });
});
