import { beforeEach, describe, expect, it, vi } from "vitest";

// setActiveOrganization: cualquier cambio a OTRA organización da de baja el dispositivo antes de activarla.
const { calls, cookieStore, membership, release, releaseIfChanges } = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    cookieStore: { get: vi.fn(), set: vi.fn((name: string) => calls.push(`set:${name}`)), delete: vi.fn() },
    membership: { data: { organization_id: "org" } as unknown },
    release: vi.fn(async () => { calls.push("release"); return "released" as const; }),
    releaseIfChanges: vi.fn(async (org: string) => { calls.push(`release-if:${org}`); return "released" as const; }),
  };
});

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "u@kmbook.test" } }, error: null }), signOut: vi.fn() },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => membership }) }) }) }) }),
  }),
}));
vi.mock("@/lib/kmbook/push-device", () => ({ releasePushDevice: release, releasePushDeviceIfOrganizationChanges: releaseIfChanges }));

import { clearActiveOrganization, logout, setActiveOrganization } from "@/lib/kmbook/auth";

beforeEach(() => {
  calls.length = 0;
  release.mockClear();
  releaseIfChanges.mockClear();
  membership.data = { organization_id: "org" };
});

describe("Staff — todos los caminos de cambio de negocio y salida", () => {
  it("setActiveOrganization (cambio directo): baja del dispositivo ANTES de activar la nueva organización", async () => {
    await setActiveOrganization("org-b");
    expect(releaseIfChanges).toHaveBeenCalledWith("org-b");
    expect(calls).toEqual(["release-if:org-b", "set:kmbook_staff_org_id"]);
  });

  it("sin membresía en la organización destino: ni baja ni cambio", async () => {
    membership.data = null;
    await expect(setActiveOrganization("org-ajena")).rejects.toThrow();
    expect(releaseIfChanges).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalledWith("kmbook_staff_org_id", "org-ajena", expect.anything());
  });

  it("clearActiveOrganization y logout dan de baja el dispositivo", async () => {
    await clearActiveOrganization();
    await logout();
    expect(release).toHaveBeenCalledTimes(2);
  });

  it("si la baja falla, el cambio de negocio y el cierre de sesión continúan", async () => {
    release.mockResolvedValueOnce("failed" as never);
    releaseIfChanges.mockResolvedValueOnce("failed" as never);
    await expect(setActiveOrganization("org-c")).resolves.toBeUndefined();
    await expect(logout()).resolves.toBeUndefined();
  });
});
