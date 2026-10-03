import { describe, it, expect, vi, beforeEach } from "vitest";

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

  describe("getOrganizationSettings (Read-Only Core Consumer)", () => {
    it("defaults to false when no row exists or function returns false", async () => {
      mockSupabase.rpc.mockImplementation(async (method: string) => {
        if (method === "get_staff_organization_settings") {
          return { data: { staff_individual_time_clock_enabled: false }, error: null };
        }
        return { data: null, error: null };
      });

      const settings = await getOrganizationSettings("org-test");
      expect(settings.staffIndividualTimeClockEnabled).toBe(false);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("get_staff_organization_settings", {
        p_organization_id: "org-test",
      });
    });

    it("returns true when staff_individual_time_clock_enabled is enabled in Core", async () => {
      mockSupabase.rpc.mockImplementation(async (method: string) => {
        if (method === "get_staff_organization_settings") {
          return { data: { staff_individual_time_clock_enabled: true }, error: null };
        }
        return { data: null, error: null };
      });

      const settings = await getOrganizationSettings("org-test");
      expect(settings.staffIndividualTimeClockEnabled).toBe(true);
    });

    it("fails closed (false) when Core RPC errors out or row is null", async () => {
      mockSupabase.rpc.mockImplementation(async (method: string) => {
        if (method === "get_staff_organization_settings") {
          return { data: null, error: { message: "Database connection failed" } };
        }
        return { data: null, error: null };
      });

      const settings = await getOrganizationSettings("org-test");
      expect(settings.staffIndividualTimeClockEnabled).toBe(false);
    });

    it("fails closed (false) when empty organizationId is provided", async () => {
      const settings = await getOrganizationSettings("");
      expect(settings.staffIndividualTimeClockEnabled).toBe(false);
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it("guarantees multi-tenant isolation across organizations without shared state", async () => {
      mockSupabase.rpc.mockImplementation(async (method: string, args: { p_organization_id: string }) => {
        if (method === "get_staff_organization_settings") {
          if (args.p_organization_id === "org-enabled") {
            return { data: { staff_individual_time_clock_enabled: true }, error: null };
          }
          if (args.p_organization_id === "org-disabled") {
            return { data: { staff_individual_time_clock_enabled: false }, error: null };
          }
        }
        return { data: null, error: null };
      });

      const enabledOrg = await getOrganizationSettings("org-enabled");
      const disabledOrg = await getOrganizationSettings("org-disabled");

      expect(enabledOrg.staffIndividualTimeClockEnabled).toBe(true);
      expect(disabledOrg.staffIndividualTimeClockEnabled).toBe(false);
    });
  });

  describe("clockAction (Server-Side Fail-Closed Guard)", () => {
    it("fails closed when staff_individual_time_clock_enabled is false (default)", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "usr-1" } as unknown as StaffUser);
      vi.mocked(getStaffViewerContext).mockResolvedValue(mockViewer as unknown as StaffViewerContext);

      // Flag is OFF in Core
      mockSupabase.rpc.mockImplementation(async (method: string) => {
        if (method === "get_staff_organization_settings") {
          return { data: { staff_individual_time_clock_enabled: false }, error: null };
        }
        return { data: null, error: null };
      });

      const res = await clockAction({
        organizationId: "org-1",
        action: "ENTRAR",
        idempotencyKey: "11111111-1111-4111-a111-111111111111",
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain("desactivado por la empresa");
      expect(res.message).toContain("Kiosk de recepción");
    });

    it("allows clock action when staff_individual_time_clock_enabled is true in Core", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "usr-1" } as unknown as StaffUser);
      vi.mocked(getStaffViewerContext).mockResolvedValue(mockViewer as unknown as StaffViewerContext);

      // Flag is ON in Core
      mockSupabase.rpc.mockImplementation(async (method: string) => {
        if (method === "get_staff_organization_settings") {
          return { data: { staff_individual_time_clock_enabled: true }, error: null };
        }
        if (method === "studio_attendance_clock") {
          return { error: null };
        }
        return { data: null, error: null };
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
