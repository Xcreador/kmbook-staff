import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(async () => mockCookieStore),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock supabase client
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(async () => mockSupabase),
}));

// Mock auth
const mockViewer = {
  user: { id: "usr-1" },
  organizations: [
    { id: "org-1", role: "employee" },
    { id: "org-owner", role: "owner" },
    { id: "org-mgr", role: "manager" },
  ],
};
vi.mock("@/lib/kmbook/auth", () => ({
  getAuthenticatedUser: vi.fn(),
  getStaffViewerContext: vi.fn(),
}));

import { getOrganizationSettings } from "@/lib/kmbook/organization-settings";
import { setStaffIndividualTimeClockEnabledAction } from "@/app/actions/organization-settings";
import { getAuthenticatedUser, getStaffViewerContext, type StaffUser, type StaffViewerContext } from "@/lib/kmbook/auth";

describe("KMBOOK Staff — Organization Settings & Time-Clock Governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrganizationSettings (Default & Governance)", () => {
    it("defaults to false when no cookie and no capability are set", async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      mockSupabase.rpc.mockResolvedValue({ data: false, error: null });

      const settings = await getOrganizationSettings("org-test");
      expect(settings.staffIndividualTimeClockEnabled).toBe(false);
    });

    it("returns true when cookie is set to true", async () => {
      mockCookieStore.get.mockReturnValue({ value: "true" });

      const settings = await getOrganizationSettings("org-test");
      expect(settings.staffIndividualTimeClockEnabled).toBe(true);
    });

    it("returns false when cookie is explicitly set to false", async () => {
      mockCookieStore.get.mockReturnValue({ value: "false" });

      const settings = await getOrganizationSettings("org-test");
      expect(settings.staffIndividualTimeClockEnabled).toBe(false);
    });

    it("returns true when capability is found via RPC and no cookie", async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

      const settings = await getOrganizationSettings("org-test");
      expect(settings.staffIndividualTimeClockEnabled).toBe(true);
    });
  });

  describe("setStaffIndividualTimeClockEnabledAction (RBAC Security)", () => {
    it("rejects unauthenticated user", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue(null);

      const res = await setStaffIndividualTimeClockEnabledAction("org-1", true);
      expect(res.success).toBe(false);
      expect(res.message).toContain("sesión ha caducado");
    });

    it("rejects employee from modifying time-clock governance", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "usr-1" } as unknown as StaffUser);
      vi.mocked(getStaffViewerContext).mockResolvedValue(mockViewer as unknown as StaffViewerContext);

      const res = await setStaffIndividualTimeClockEnabledAction("org-1", true);
      expect(res.success).toBe(false);
      expect(res.message).toContain("Solo la administración");
    });

    it("allows owner to toggle feature flag", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "usr-1" } as unknown as StaffUser);
      vi.mocked(getStaffViewerContext).mockResolvedValue(mockViewer as unknown as StaffViewerContext);
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      const res = await setStaffIndividualTimeClockEnabledAction("org-owner", true);
      expect(res.success).toBe(true);
      expect(res.enabled).toBe(true);
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "kmbook_org_clock_org-owner",
        "true",
        expect.any(Object),
      );
    });

    it("allows manager to toggle feature flag", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "usr-1" } as unknown as StaffUser);
      vi.mocked(getStaffViewerContext).mockResolvedValue(mockViewer as unknown as StaffViewerContext);
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      const res = await setStaffIndividualTimeClockEnabledAction("org-mgr", false);
      expect(res.success).toBe(true);
      expect(res.enabled).toBe(false);
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "kmbook_org_clock_org-mgr",
        "false",
        expect.any(Object),
      );
    });
  });
});
