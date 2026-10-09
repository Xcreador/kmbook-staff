import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const core = vi.hoisted(() => ({
  granted: new Set<string>(),
  fail: false,
  rpcCalls: [] as Array<{ name: string; key?: string }>,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      core.rpcCalls.push({ name, key: args.p_capability_key as string | undefined });
      if (core.fail) throw new Error("network down");
      if (name === "has_studio_capability") return { data: core.granted.has(String(args.p_capability_key)), error: null };
      return { data: null, error: { message: "access_denied" } };
    },
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "neq", "gte", "lte", "in", "order", "limit"]) chain[m] = () => chain;
      chain.maybeSingle = async () => ({ data: null, error: null });
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
      return chain;
    },
  }),
}));

const viewerState = vi.hoisted(() => ({ role: "owner" as string }));
vi.mock("@/lib/kmbook/auth", () => ({
  getAuthenticatedUser: async () => ({ id: "u1", email: null }),
  getStaffViewerContext: async () => {
    const org = { id: "org-1", name: "Salón", slug: "s", currency: "EUR", timezone: "Europe/Madrid", role: viewerState.role };
    return {
      user: { id: "u1", email: "x@example.com" },
      profile: { id: "u1", displayName: "Laura", avatarUrl: null },
      organizations: [org],
      locations: [],
      activeOrganization: org,
      professionalRecord: null,
    };
  },
  clearActiveOrganization: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("@/lib/kmbook/notifications", () => ({ getUnreadNotificationCount: async () => 0 }));

const BUSINESS = "https://business.example.com";
const { deriveStudioAccess, getStudioAccess } = await import("@/lib/kmbook/studio-access");
const { BusinessAccessCard } = await import("@/components/BusinessAccessCard");
const { default: ProfilePage } = await import("@/app/profile/page");

const ROLES = ["owner", "manager", "reception", "professional"] as const;
const TPV_CASES: Array<[string, string[]]> = [
  ["payment.collect", ["payment.collect"]],
  ["cash_register.access", ["cash_register.access"]],
  ["ninguno", []],
];

beforeEach(() => {
  core.granted = new Set();
  core.fail = false;
  core.rpcCalls = [];
  vi.stubEnv("KMBOOK_BUSINESS_URL", BUSINESS);
});

describe("deriveStudioAccess (pura)", () => {
  it("TPV: payment.collect o cash_register.access conceden SOLO el TPV", () => {
    for (const key of ["payment.collect", "cash_register.access"]) {
      expect(deriveStudioAccess(new Set([key]), BUSINESS)).toEqual({ tpv: { href: `${BUSINESS}/app/studio/pos` }, admin: null });
    }
  });
  it("roles.manage concede el acceso de gestión, no el TPV", () => {
    expect(deriveStudioAccess(new Set(["roles.manage"]), BUSINESS)).toEqual({ tpv: null, admin: { href: `${BUSINESS}/app/studio` } });
  });
  it("sin origen no hay enlaces aunque haya permisos", () => {
    expect(deriveStudioAccess(new Set(["payment.collect", "roles.manage"]), null)).toEqual({ tpv: null, admin: null });
  });
  it("permisos ajenos (payment.view, finance.manage…) no conceden nada", () => {
    expect(deriveStudioAccess(new Set(["payment.view", "finance.manage", "staff.manage"]), BUSINESS)).toEqual({ tpv: null, admin: null });
  });
});

describe("Perfil · matriz rol × permiso TPV × permiso administrativo", () => {
  for (const role of ROLES) {
    for (const [tpvLabel, tpvKeys] of TPV_CASES) {
      for (const admin of [true, false]) {
        const label = `${role} · TPV=${tpvLabel} · admin=${admin ? "concedido" : "revocado"}`;
        it(label, async () => {
          viewerState.role = role;
          core.granted = new Set([...tpvKeys, ...(admin ? ["roles.manage"] : [])]);
          const html = renderToStaticMarkup(await ProfilePage());

          const hasTpv = tpvKeys.length > 0;
          // El enlace depende SOLO del permiso, nunca del rol.
          expect(html.includes(`${BUSINESS}/app/studio/pos`)).toBe(hasTpv);
          expect(html.includes('data-testid="business-access-tpv"')).toBe(hasTpv);
          expect(html.includes(`href="${BUSINESS}/app/studio"`)).toBe(admin);
          expect(html.includes("Abrir KMBOOK Business")).toBe(admin);
          // Los textos antiguos no vuelven.
          expect(html).not.toContain("administración completa");
          expect(html).not.toContain("kmbook.es");
          if (!hasTpv && !admin) expect(html).not.toContain("KMBOOK BUSINESS");
        });
      }
    }
  }

  it("TPV concedido NUNCA muestra el acceso administrativo", async () => {
    viewerState.role = "manager";
    core.granted = new Set(["payment.collect", "cash_register.access"]);
    const html = renderToStaticMarkup(await ProfilePage());
    expect(html).toContain("Abrir TPV");
    expect(html).not.toContain("Abrir KMBOOK Business");
    expect(html).not.toContain('data-testid="business-access-admin"');
  });

  it("rol «owner» sin permiso: no hay enlace (el rol no autoriza)", async () => {
    viewerState.role = "owner";
    const html = renderToStaticMarkup(await ProfilePage());
    expect(html).not.toContain("business-access");
    expect(html).not.toContain("/app/studio");
  });

  it("rol «professional» con permisos expresos sí los ve (el permiso manda, no el rol)", async () => {
    viewerState.role = "professional";
    core.granted = new Set(["cash_register.access"]);
    expect(renderToStaticMarkup(await ProfilePage())).toContain(`${BUSINESS}/app/studio/pos`);
  });

  it("consulta los permisos a Core con has_studio_capability", async () => {
    await getStudioAccess("org-1", BUSINESS);
    expect(core.rpcCalls.map((c) => c.key).sort()).toEqual(["cash_register.access", "payment.collect", "roles.manage"]);
    expect(core.rpcCalls.every((c) => c.name === "has_studio_capability")).toBe(true);
  });

  it("si Core falla, cerrado por defecto", async () => {
    core.fail = true;
    core.granted = new Set(["payment.collect", "roles.manage"]);
    expect(await getStudioAccess("org-1", BUSINESS)).toEqual({ tpv: null, admin: null });
  });
});

describe("Perfil · URL de Business", () => {
  const withPerms = async () => {
    viewerState.role = "owner";
    core.granted = new Set(["payment.collect", "roles.manage"]);
    return renderToStaticMarkup(await ProfilePage());
  };

  it.each([
    ["ausente", ""],
    ["inválida", "no-es-url"],
    ["http", "http://business.example.com"],
    ["con credenciales", "https://u:p@business.example.com"],
    ["con ruta", "https://business.example.com/x"],
  ])("URL %s → accesos ocultos aunque haya permisos", async (_n, value) => {
    vi.stubEnv("KMBOOK_BUSINESS_URL", value);
    vi.stubEnv("NEXT_PUBLIC_BUSINESS_URL", "");
    const html = await withPerms();
    expect(html).not.toContain("business-access");
    expect(html).not.toContain("/app/studio");
    expect(core.rpcCalls.filter((c) => c.name === "has_studio_capability")).toHaveLength(0); // nada que mostrar: ni consulta
  });

  it("URL válida → enlaces exactos", async () => {
    vi.stubEnv("KMBOOK_BUSINESS_URL", "https://Business.Example.com/");
    const html = await withPerms();
    expect(html).toContain('href="https://business.example.com/app/studio/pos"');
    expect(html).toContain('href="https://business.example.com/app/studio"');
  });
});

describe("BusinessAccessCard · textos por ámbito", () => {
  it("TPV: honesto, sin «administración completa»", () => {
    const html = renderToStaticMarkup(<BusinessAccessCard access={{ tpv: { href: `${BUSINESS}/app/studio/pos` }, admin: null }} />);
    expect(html).toContain("Abrir TPV");
    expect(html).toContain("Solo el TPV");
    expect(html).not.toContain("administración");
  });
  it("gestión administrativa", () => {
    const html = renderToStaticMarkup(<BusinessAccessCard access={{ tpv: null, admin: { href: `${BUSINESS}/app/studio` } }} />);
    expect(html).toContain("Gestión administrativa");
    expect(html).not.toContain("Abrir TPV");
  });
  it("sin accesos no renderiza nada", () => {
    expect(renderToStaticMarkup(<BusinessAccessCard access={{ tpv: null, admin: null }} />)).toBe("");
  });
});
