/**
 * KMBOOK Staff ↔ KMBOOK Core #117 — contrato del fichaje desde el dispositivo.
 *
 * Core expone SÓLO lectura para Staff:
 *   get_staff_organization_settings(p_organization_id) →
 *     jsonb { staff_individual_time_clock_enabled: boolean }
 *   (42501 authentication_required / access_denied si no hay sesión o
 *    membresía activa). El cambio (set_staff_organization_settings) es de
 *   Business y sólo para owner/manager.
 *
 * Casos:
 *   A  ajuste ON → fichaje Staff disponible
 *   B  ajuste OFF → fichaje Staff bloqueado (también en servidor)
 *   C  fallo o respuesta inesperada al leer el ajuste → bloqueado
 *   D  organización A ON / organización B OFF
 *   E  cambio A → B sin estado residual
 *   F  acceso directo a /time-clock con OFF
 *   G  sin membresía activa
 *   H  Staff no puede modificar el ajuste
 *   I  el Kiosk de recepción no queda afectado
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: navigation.redirect,
  usePathname: () => "/time-clock",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: navigation.refresh, forward: vi.fn(), prefetch: vi.fn() }),
  notFound: vi.fn(),
}));

/** Ajuste por organización tal como lo devolvería Core. */
type CoreReply = { data?: unknown; error?: { message: string; code?: string } | null; throws?: boolean };
const core = vi.hoisted(() => ({
  settings: new Map<string, CoreReply>(),
  calls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  tables: [] as string[],
}));

function fakeQuery(table: string) {
  core.tables.push(table);
  const result = { data: [], error: null };
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "gte", "lte", "in", "order", "limit"]) {
    chain[method] = () => chain;
  }
  chain.maybeSingle = async () => ({ data: null, error: null });
  chain.then = (resolve: (value: typeof result) => unknown) => resolve(result);
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      core.calls.push({ name, args });
      if (name === "get_staff_organization_settings") {
        const reply = core.settings.get(String(args.p_organization_id)) ?? {
          data: null,
          error: { message: "access_denied", code: "42501" },
        };
        if (reply.throws) throw new Error("network down");
        return { data: reply.data ?? null, error: reply.error ?? null };
      }
      return { data: null, error: null };
    },
    from: (table: string) => fakeQuery(table),
  }),
}));

const viewerState = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/kmbook/auth", () => ({
  getAuthenticatedUser: async () => (viewerState.current ? { id: "user-1", email: null } : null),
  getStaffViewerContext: async () => viewerState.current,
}));
vi.mock("@/lib/kmbook/notifications", () => ({ getUnreadNotificationCount: async () => 0 }));

const ORG_A = { id: "aaaaaaaa-0000-4000-8000-00000000000a", name: "Salón A", slug: "a", currency: "EUR", timezone: "Europe/Madrid", role: "professional" };
const ORG_B = { id: "bbbbbbbb-0000-4000-8000-00000000000b", name: "Salón B", slug: "b", currency: "EUR", timezone: "Europe/Madrid", role: "professional" };

function viewer(active: typeof ORG_A | null, organizations = [ORG_A, ORG_B]) {
  return {
    user: { id: "user-1", email: null },
    profile: { id: "user-1", displayName: "Laura", avatarUrl: null },
    organizations,
    locations: [],
    activeOrganization: active,
    professionalRecord: null,
  };
}
const ON = { data: { staff_individual_time_clock_enabled: true } };
const OFF = { data: { staff_individual_time_clock_enabled: false } };
const KEY = "11111111-1111-4111-a111-111111111111";

const { getOrganizationSettings, parseStaffOrganizationSettings } = await import("@/lib/kmbook/organization-settings");
const { getStaffTimeClockAccess } = await import("@/lib/kmbook/staff-time-clock-access");
const { clockAction, getHistoryAction, getTodaySessionAction, getActiveLocationsAction } = await import("@/app/actions/time-clock");
const { default: TimeClockPage } = await import("@/app/time-clock/page");
const { TimeClockCard } = await import("@/components/TimeClockCard");

const attendanceWrites = () => core.calls.filter((call) => call.name === "studio_attendance_clock");

beforeEach(() => {
  core.settings.clear();
  core.calls = [];
  core.tables = [];
  viewerState.current = viewer(ORG_A);
  navigation.redirect.mockClear();
});

describe("A · ajuste ON → fichaje Staff disponible", () => {
  it("el guard permite y clockAction escribe con studio_attendance_clock en la organización activa", async () => {
    core.settings.set(ORG_A.id, ON);
    expect((await getStaffTimeClockAccess()).allowed).toBe(true);

    const res = await clockAction({ organizationId: ORG_A.id, action: "ENTRAR", idempotencyKey: KEY });
    expect(res.success).toBe(true);
    expect(attendanceWrites()).toEqual([
      { name: "studio_attendance_clock", args: { p_organization_id: ORG_A.id, p_location_id: null, p_action: "start", p_idempotency_key: KEY } },
    ]);
  });

  it("/time-clock muestra el fichaje (sin estado de no disponible)", async () => {
    core.settings.set(ORG_A.id, ON);
    const html = renderToStaticMarkup(await TimeClockPage());
    expect(html).not.toContain("time-clock-unavailable");
    expect(html).toContain("HISTORIAL");
  });
});

describe("B · ajuste OFF → fichaje Staff bloqueado", () => {
  it("clockAction no llega a escribir aunque el cliente lo intente", async () => {
    core.settings.set(ORG_A.id, OFF);
    for (const action of ["ENTRAR", "INICIAR_PAUSA", "REANUDAR", "SALIR"] as const) {
      const res = await clockAction({ organizationId: ORG_A.id, action, idempotencyKey: KEY });
      expect(res.success).toBe(false);
      expect(res.message).toBe("Fichaje desde este dispositivo no disponible. Tu salón registra la jornada en el terminal de recepción.");
    }
    expect(attendanceWrites()).toHaveLength(0);
  });

  it("las lecturas de fichaje también quedan cerradas", async () => {
    core.settings.set(ORG_A.id, OFF);
    await expect(getTodaySessionAction(ORG_A.id)).rejects.toThrow("terminal de recepción");
    expect(await getHistoryAction(ORG_A.id)).toEqual([]);
    expect(await getActiveLocationsAction(ORG_A.id)).toEqual([]);
    expect(core.tables).not.toContain("studio_attendance_sessions");
  });
});

describe("B · la empresa lo desactiva con la pantalla abierta", () => {
  it("la tarjeta deja de ofrecer acciones y refresca desde el servidor", async () => {
    core.settings.set(ORG_A.id, OFF);
    navigation.refresh.mockClear();
    render(
      <TimeClockCard
        organizationId={ORG_A.id}
        userId="user-1"
        initialShift={{
          id: "s1", organizationId: ORG_A.id, userId: "user-1", locationId: null, date: "2026-10-04",
          state: "TRABAJANDO", clockInTime: new Date().toISOString(), clockOutTime: null,
          totalWorkedSeconds: 0, totalBreakSeconds: 0, currentBreakStartedAt: null, plannedStart: "09:00", plannedEnd: "17:00",
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /PAUSA/ }));
    await screen.findByText(/Fichaje desde este dispositivo no disponible/);
    await waitFor(() => expect(screen.queryByRole("button", { name: /PAUSA|SALIR|ENTRAR|REANUDAR/ })).toBeNull());
    expect(navigation.refresh).toHaveBeenCalled();
    expect(attendanceWrites()).toHaveLength(0);
  });
});

describe("C · fallo leyendo el ajuste → bloqueado (fail-closed)", () => {
  const unexpected: Array<[string, CoreReply]> = [
    ["error de la RPC", { error: { message: "boom" } }],
    ["sesión inválida (authentication_required)", { error: { message: "authentication_required", code: "42501" } }],
    ["excepción de red", { throws: true }],
    ["respuesta nula", { data: null }],
    ["texto «true»", { data: { staff_individual_time_clock_enabled: "true" } }],
    ["número 1", { data: { staff_individual_time_clock_enabled: 1 } }],
    ["objeto sin la clave", { data: {} }],
    ["array", { data: [{ staff_individual_time_clock_enabled: true }] }],
    ["booleano suelto", { data: true }],
  ];

  it.each(unexpected)("%s → no disponible y sin escritura", async (_label, reply) => {
    core.settings.set(ORG_A.id, reply);
    const settings = await getOrganizationSettings(ORG_A.id);
    expect(settings).toEqual({ staffIndividualTimeClockEnabled: false, status: "unavailable" });

    const res = await clockAction({ organizationId: ORG_A.id, action: "ENTRAR", idempotencyKey: KEY });
    expect(res.success).toBe(false);
    expect(res.message).toContain("Fichaje desde este dispositivo no disponible");
    expect(attendanceWrites()).toHaveLength(0);
  });

  it("sólo un booleano true estricto activa; false explícito es «desactivado»", () => {
    expect(parseStaffOrganizationSettings({ staff_individual_time_clock_enabled: true }).status).toBe("enabled");
    expect(parseStaffOrganizationSettings({ staff_individual_time_clock_enabled: false }).status).toBe("disabled");
    expect(parseStaffOrganizationSettings(undefined).status).toBe("unavailable");
  });

  it("si cargar la sesión falla, el guard también bloquea", async () => {
    viewerState.current = Promise.reject(new Error("db down"));
    const access = await getStaffTimeClockAccess(ORG_A.id);
    expect(access).toEqual({ allowed: false, reason: "unavailable" });
  });
});

describe("D · organización A ON / organización B OFF", () => {
  it("cada organización se lee por separado, sin estado compartido", async () => {
    core.settings.set(ORG_A.id, ON);
    core.settings.set(ORG_B.id, OFF);
    expect((await getOrganizationSettings(ORG_A.id)).status).toBe("enabled");
    expect((await getOrganizationSettings(ORG_B.id)).status).toBe("disabled");
    expect((await getOrganizationSettings(ORG_A.id)).status).toBe("enabled");
    const reads = core.calls.filter((call) => call.name === "get_staff_organization_settings").map((call) => call.args.p_organization_id);
    expect(reads).toEqual([ORG_A.id, ORG_B.id, ORG_A.id]);
  });

  it("con A activa se ficha en A; con B activa no se ficha en B", async () => {
    core.settings.set(ORG_A.id, ON);
    core.settings.set(ORG_B.id, OFF);
    expect((await clockAction({ organizationId: ORG_A.id, action: "ENTRAR", idempotencyKey: KEY })).success).toBe(true);

    viewerState.current = viewer(ORG_B);
    expect((await clockAction({ organizationId: ORG_B.id, action: "ENTRAR", idempotencyKey: KEY })).success).toBe(false);
    expect(attendanceWrites().map((call) => call.args.p_organization_id)).toEqual([ORG_A.id]);
  });
});

describe("E · cambio A → B sin estado residual", () => {
  it("una pestaña antigua de A no puede fichar ni leer tras activar B (aunque A siga ON)", async () => {
    core.settings.set(ORG_A.id, ON);
    core.settings.set(ORG_B.id, OFF);
    viewerState.current = viewer(ORG_B);

    const res = await clockAction({ organizationId: ORG_A.id, action: "ENTRAR", idempotencyKey: KEY });
    expect(res).toEqual({ success: false, blocked: true, message: "Has cambiado de salón. Vuelve a abrir el fichaje." });
    expect(await getHistoryAction(ORG_A.id)).toEqual([]);
    expect(attendanceWrites()).toHaveLength(0);
    expect(core.calls.some((call) => call.name === "get_staff_organization_settings" && call.args.p_organization_id === ORG_A.id)).toBe(false);
  });

  it("/time-clock tras pasar a B (OFF) muestra no disponible, aunque A estuviera ON", async () => {
    core.settings.set(ORG_A.id, ON);
    core.settings.set(ORG_B.id, OFF);
    expect(renderToStaticMarkup(await TimeClockPage())).not.toContain("time-clock-unavailable");

    viewerState.current = viewer(ORG_B);
    const html = renderToStaticMarkup(await TimeClockPage());
    expect(html).toContain("time-clock-unavailable");
    expect(html).not.toContain("HISTORIAL");
    // B se leyó con su propio id; el resultado de A no se reutiliza.
    const reads = core.calls.filter((call) => call.name === "get_staff_organization_settings").map((call) => call.args.p_organization_id);
    expect(reads).toEqual([ORG_A.id, ORG_B.id]);
  });

  it("los componentes de fichaje se montan con key por organización", () => {
    const today = readFileSync(path.resolve(__dirname, "../app/today/page.tsx"), "utf8");
    const page = readFileSync(path.resolve(__dirname, "../app/time-clock/page.tsx"), "utf8");
    expect(today).toMatch(/<TimeClockCard\s+key=\{org\.id\}/);
    expect(page).toMatch(/<TimeClockView\s+key=\{org\.id\}/);
  });

  it("el service worker no sirve páginas autenticadas desde caché", () => {
    const sw = readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");
    expect(sw).toContain('const CACHE_NAME = "kmbook-staff-v2"');
    expect(sw).not.toMatch(/SHELL_ASSETS = \[[^\]]*"\/today"/);
    expect(sw).not.toContain('caches.match("/today")');
  });
});

describe("F · acceso directo a /time-clock con OFF", () => {
  it("muestra un estado claro, sin controles ni datos de fichaje", async () => {
    core.settings.set(ORG_A.id, OFF);
    const html = renderToStaticMarkup(await TimeClockPage());
    expect(html).toContain("time-clock-unavailable");
    expect(html).toContain("Fichaje desde este dispositivo no disponible");
    expect(html).toContain("Tu salón registra la jornada en el terminal de recepción.");
    expect(html).toContain('href="/today"');
    expect(html).not.toContain("HISTORIAL");
    expect(html).not.toMatch(/ENTRAR|SALIR/);
    expect(core.tables).not.toContain("studio_attendance_sessions");
  });

  it("no expone jerga técnica a la profesional", async () => {
    core.settings.set(ORG_A.id, { error: { message: "permission denied for function get_staff_organization_settings", code: "42501" } });
    const html = renderToStaticMarkup(await TimeClockPage());
    for (const jargon of ["get_staff_organization_settings", "staff_individual_time_clock_enabled", "42501", "RPC", "Supabase", "flag", "permission"]) {
      expect(html).not.toContain(jargon);
    }
  });
});

describe("G · sin membresía activa", () => {
  it("sin organización activa: redirige a elegir salón y no ficha", async () => {
    viewerState.current = viewer(null, []);
    await expect(TimeClockPage()).rejects.toThrow("NEXT_REDIRECT:/select-organization");
    const res = await clockAction({ organizationId: ORG_A.id, action: "ENTRAR", idempotencyKey: KEY });
    expect(res.success).toBe(false);
    expect(attendanceWrites()).toHaveLength(0);
  });

  it("Core niega la lectura (membresía inactiva / organización inexistente) → bloqueado", async () => {
    // Sin entrada en el mapa, el doble de Core responde 42501 access_denied.
    const res = await clockAction({ organizationId: ORG_A.id, action: "ENTRAR", idempotencyKey: KEY });
    expect(res.success).toBe(false);
    expect(attendanceWrites()).toHaveLength(0);
  });

  it("sin sesión: /time-clock redirige a login y la acción no escribe", async () => {
    viewerState.current = null;
    await expect(TimeClockPage()).rejects.toThrow("NEXT_REDIRECT:/login");
    const res = await clockAction({ organizationId: ORG_A.id, action: "ENTRAR", idempotencyKey: KEY });
    expect(res).toEqual({ success: false, blocked: true, message: "Tu sesión ha caducado. Vuelve a iniciar sesión." });
  });

  it("organizationId de una organización ajena no se acepta", async () => {
    core.settings.set("cccccccc-0000-4000-8000-00000000000c", ON);
    const res = await clockAction({ organizationId: "cccccccc-0000-4000-8000-00000000000c", action: "ENTRAR", idempotencyKey: KEY });
    expect(res.success).toBe(false);
    expect(attendanceWrites()).toHaveLength(0);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "__tests__" ? [] : sourceFiles(full);
    return /\.(ts|tsx|js)$/.test(entry) ? [full] : [];
  });
}
const SRC = path.resolve(__dirname, "..");
const staffSources = sourceFiles(SRC).map((file) => ({ file, text: readFileSync(file, "utf8") }));

describe("H · Staff no puede modificar el ajuste", () => {
  it("ningún código de Staff llama a set_staff_organization_settings ni toca studio_staff_settings", () => {
    const offenders = staffSources.filter(({ text }) => /set_staff_organization_settings|studio_staff_settings/.test(text));
    expect(offenders.map(({ file }) => path.relative(SRC, file))).toEqual([]);
  });

  it("los tipos de Staff sólo declaran la lectura", () => {
    const types = readFileSync(path.resolve(SRC, "types/database.ts"), "utf8");
    expect(types).toContain("get_staff_organization_settings");
    expect(types).not.toContain("set_staff_organization_settings");
  });

  it("el flujo de fichaje sólo invoca la lectura del ajuste", async () => {
    core.settings.set(ORG_A.id, ON);
    await clockAction({ organizationId: ORG_A.id, action: "ENTRAR", idempotencyKey: KEY });
    expect(new Set(core.calls.map((call) => call.name))).toEqual(new Set(["get_staff_organization_settings", "studio_attendance_clock"]));
  });
});

describe("I · el Kiosk de recepción no queda afectado", () => {
  it("Staff no usa ni condiciona studio_attendance_clock_with_pin ni studio_attendance_kiosk_roster", () => {
    // Los tipos generados de Core las declaran; Staff no las invoca nunca.
    const offenders = staffSources.filter(({ text }) => /rpc\(\s*"(studio_attendance_clock_with_pin|studio_attendance_kiosk_roster)"/.test(text));
    expect(offenders.map(({ file }) => path.relative(SRC, file))).toEqual([]);
  });

  it("la única escritura condicionada por el ajuste es el fichaje personal (studio_attendance_clock)", () => {
    const writers = staffSources.filter(({ text }) => /rpc\(\s*"studio_attendance_/.test(text));
    expect(writers.map(({ file }) => path.relative(SRC, file))).toEqual(["app/actions/time-clock.ts"]);
    const action = readFileSync(path.resolve(SRC, "app/actions/time-clock.ts"), "utf8");
    expect(action.match(/rpc\(\s*"(studio_attendance_\w+)"/g)).toEqual(['rpc("studio_attendance_clock"']);
  });
});
