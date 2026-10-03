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
  activeOrganization: { id: "org-1", name: "KM Salon", role: "employee" },
  organizations: [
    { id: "org-1", role: "employee" },
    { id: "org-2", role: "owner" },
  ],
};
vi.mock("@/lib/kmbook/auth", () => ({
  getAuthenticatedUser: vi.fn(),
  getStaffViewerContext: vi.fn(),
}));

// Mock time-clock helper
vi.mock("@/lib/kmbook/time-clock", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/kmbook/time-clock")>();
  return {
    ...original,
    fetchTodaySessionFromSupabase: vi.fn().mockResolvedValue({
      status: "TRABAJANDO",
      stateLabel: "Trabajando",
      clockInTime: "2026-10-03T09:00:00Z",
      clockOutTime: null,
      totalWorkedSeconds: 3600,
      totalBreakSeconds: 0,
      currentBreakStartedAt: null,
      plannedStart: "09:00",
      plannedEnd: "17:00",
    }),
  };
});

import { getOrganizationSettings } from "@/lib/kmbook/organization-settings";
import { clockAction } from "@/app/actions/time-clock";
import { getAuthenticatedUser, getStaffViewerContext, type StaffUser, type StaffViewerContext } from "@/lib/kmbook/auth";

describe("KMBOOK Staff — Organization Settings & Read-Only Governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrganizationSettings (Read-Only Consumer)", () => {
    it("defaults to false when no cookie and no capability are set", async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      mockSupabase.rpc.mockResolvedValue({ data: false, error: null });

      const settings = await getOrganizationSettings("org-test");
      expect(settings.staffIndividualTimeClockEnabled).toBe(false);
    });

    it("returns true when capability is granted in Core via RPC", async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

      const settings = await getOrganizationSettings("org-test");
      expect(settings.staffIndividualTimeClockEnabled).toBe(true);
    });

    it("returns false when RPC fails or returns false", async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "Not granted" } });

      const settings = await getOrganizationSettings("org-test");
      expect(settings.staffIndividualTimeClockEnabled).toBe(false);
    });

    it("respects organizational cookie when set to true", async () => {
      mockCookieStore.get.mockReturnValue({ value: "true" });

      const settings = await getOrganizationSettings("org-test");
      expect(settings.staffIndividualTimeClockEnabled).toBe(true);
    });

    it("respects organizational cookie when set to false", async () => {
      mockCookieStore.get.mockReturnValue({ value: "false" });

      const settings = await getOrganizationSettings("org-test");
      expect(settings.staffIndividualTimeClockEnabled).toBe(false);
    });
  });

  describe("clockAction (Server-Side Fail-Closed Guard)", () => {
    it("fails closed when staff_individual_time_clock_enabled is false (default)", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "usr-1" } as unknown as StaffUser);
      vi.mocked(getStaffViewerContext).mockResolvedValue(mockViewer as unknown as StaffViewerContext);

      // Flag is OFF (default)
      mockCookieStore.get.mockReturnValue(undefined);
      mockSupabase.rpc.mockResolvedValue({ data: false, error: null });

      const res = await clockAction({
        organizationId: "org-1",
        action: "ENTRAR",
        idempotencyKey: "11111111-1111-4111-a111-111111111111",
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain("desactivado por la empresa");
      expect(res.message).toContain("Kiosk de recepción");
    });

    it("allows clock action when staff_individual_time_clock_enabled is true", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "usr-1" } as unknown as StaffUser);
      vi.mocked(getStaffViewerContext).mockResolvedValue(mockViewer as unknown as StaffViewerContext);

      // Flag is ON
      mockCookieStore.get.mockReturnValue({ value: "true" });
      mockSupabase.rpc.mockImplementation(async (method: string) => {
        if (method === "studio_attendance_clock") {
          return { error: null };
        }
        return { data: true, error: null };
      });

      const res = await clockAction({
        organizationId: "org-1",
        action: "ENTRAR",
        idempotencyKey: "11111111-1111-4111-a111-111111111111",
      });

      expect(res.success).toBe(true);
      expect(res.message).toBe("Fichaje registrado.");
    });
  });
});
