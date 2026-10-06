import { describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn(() => ({ auth: { getClaims } })) }));

import { NextRequest } from "next/server";

import { refreshAuthSession } from "@/lib/supabase/proxy";

describe("refresco de sesión (proxy)", () => {
  it("con configuración pública refresca la sesión en cada navegación", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-placeholder-key");
    getClaims.mockResolvedValue({ data: null, error: null });
    const response = await refreshAuthSession(new NextRequest("https://staff.test/today"));
    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("una caída de Auth no tumba la navegación", async () => {
    getClaims.mockRejectedValue(new Error("auth down"));
    const response = await refreshAuthSession(new NextRequest("https://staff.test/today"));
    expect(response.status).toBe(200);
  });

  it("sin configuración pública devuelve la respuesta intacta (las rutas protegidas fallan cerradas)", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    getClaims.mockClear();
    const response = await refreshAuthSession(new NextRequest("https://staff.test/today"));
    expect(getClaims).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});
