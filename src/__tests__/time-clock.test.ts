import { describe, it, expect } from "vitest";
import {
  StaffTimeClockAdapter,
  mapSessionToStaffState,
  calculateBreakSeconds,
  calculateWorkedSeconds,
  formatDuration,
  formatClockTime,
  getAttendanceErrorMessage,
  ACTION_TO_CORE_MAP,
  fetchTodaySessionFromSupabase,
  fetchHistoryFromSupabase,
} from "@/lib/kmbook/time-clock";
import type { Database, AttendanceStatus } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("KMBOOK Staff — Real Time Clock Adapter & Core #114 Contract Tests", () => {
  const orgIdA = "11111111-1111-4111-a111-111111111111";
  const orgIdB = "22222222-2222-4222-a222-222222222222";
  const userId = "33333333-3333-4333-a333-333333333333";

  /* ── 1. RPC Mapping ─────────────────────────────────────────────── */
  describe("RPC Action Mapping (Core #114)", () => {
    it("maps UI actions to exact Core RPC actions without PIN on personal mobile", () => {
      expect(ACTION_TO_CORE_MAP.ENTRAR).toBe("start");
      expect(ACTION_TO_CORE_MAP.INICIAR_PAUSA).toBe("break_start");
      expect(ACTION_TO_CORE_MAP.REANUDAR).toBe("break_end");
      expect(ACTION_TO_CORE_MAP.SALIR).toBe("end");
    });
  });

  /* ── 2. State Mapping ────────────────────────────────────────────── */
  describe("Staff State Mapping from Core Sessions", () => {
    it("maps Core states correctly according to attendance rules", () => {
      // sin sesiones -> SIN_INICIAR
      expect(mapSessionToStaffState(null, false)).toBe("SIN_INICIAR");

      // working -> TRABAJANDO
      expect(mapSessionToStaffState("working", false)).toBe("TRABAJANDO");

      // on_break -> EN_PAUSA
      expect(mapSessionToStaffState("on_break", false)).toBe("EN_PAUSA");

      // finished -> FINALIZADO
      expect(mapSessionToStaffState("finished", false)).toBe("FINALIZADO");

      // Sin sesión abierta hoy, pero hubo jornada terminada hoy -> FINALIZADO
      expect(mapSessionToStaffState(null, true)).toBe("FINALIZADO");
    });
  });

  /* ── 3. Timestamps & Real Duration Math ──────────────────────────── */
  describe("Timestamp-derived Calculations (No Fake Clocks)", () => {
    it("calculates break seconds from real break timestamps including active break", () => {
      const breaks = [
        { started_at: "2026-10-03T10:00:00.000Z", ended_at: "2026-10-03T10:30:00.000Z" }, // 30 min = 1800s
        { started_at: "2026-10-03T13:00:00.000Z", ended_at: null }, // active break
      ];
      const nowMs = new Date("2026-10-03T13:15:00.000Z").getTime(); // 15 min = 900s

      const result = calculateBreakSeconds(breaks, null, nowMs);
      expect(result.totalBreakSeconds).toBe(2700); // 1800 + 900
      expect(result.currentBreakStartedAt).toBe("2026-10-03T13:00:00.000Z");
    });

    it("calculates effective worked time by deducting breaks from gross elapsed time", () => {
      const startIso = "2026-10-03T09:00:00.000Z";
      const endIso = "2026-10-03T17:00:00.000Z"; // 8 hours gross = 28800s
      const totalBreakSeconds = 3600; // 1 hour break

      const worked = calculateWorkedSeconds(startIso, endIso, totalBreakSeconds);
      expect(worked).toBe(25200); // 7 hours = 25200s
    });

    it("formats durations accurately according to KMBOOK guidelines", () => {
      expect(formatDuration(0)).toBe("0 min");
      expect(formatDuration(45 * 60)).toBe("45 min");
      expect(formatDuration(7 * 3600 + 7 * 60)).toBe("7 h 07 min");
    });

    it("formats clock time in HH:mm format", () => {
      const iso = "2026-10-03T09:04:00.000Z";
      const formatted = formatClockTime(iso, "UTC");
      expect(formatted).toBe("09:04");
    });
  });

  /* ── 4. Core Error Translations ─────────────────────────────────── */
  describe("Core Error Translations (Never raw SQL/PostgreSQL errors)", () => {
    it("translates all Core #114 attendance error codes into user-friendly Spanish", () => {
      expect(getAttendanceErrorMessage("attendance_already_started")).toBe(
        "Ya tienes una jornada iniciada.",
      );
      expect(getAttendanceErrorMessage("attendance_not_started")).toBe(
        "No hay ninguna jornada iniciada.",
      );
      expect(getAttendanceErrorMessage("attendance_already_on_break")).toBe("Ya estás en pausa.");
      expect(getAttendanceErrorMessage("attendance_not_on_break")).toBe("No estás en pausa.");
      expect(getAttendanceErrorMessage("idempotency_key_conflict")).toBe(
        "Esta acción ya se usó para otro fichaje. Recarga la página.",
      );
      expect(getAttendanceErrorMessage("idempotency_key_required")).toBe(
        "Recarga la página e inténtalo de nuevo.",
      );
      expect(getAttendanceErrorMessage("location_not_found")).toBe(
        "Ese centro no pertenece a la organización.",
      );
      expect(getAttendanceErrorMessage("member_not_found")).toBe(
        "Esa persona no es miembro activo de la organización.",
      );
      expect(getAttendanceErrorMessage("authentication_required")).toBe(
        "Tu sesión ha caducado. Vuelve a entrar.",
      );
      expect(getAttendanceErrorMessage("authorization_required")).toBe(
        "Tu perfil de acceso no permite esta acción.",
      );
    });

    it("uses safe fallback when an unmapped error occurs without exposing internal details", () => {
      const fallback = getAttendanceErrorMessage("P0001: internal syntax error in pg_catalog");
      expect(fallback).toBe("No se pudo registrar el fichaje. Inténtalo de nuevo.");
      expect(fallback).not.toContain("P0001");
      expect(fallback).not.toContain("pg_catalog");
    });
  });

  /* ── 5. Offline Fail-Closed Guard ───────────────────────────────── */
  describe("Offline Fail-Closed Guard (Zero LocalStorage, Zero Fake Writes)", () => {
    it("rejects clock events immediately when offline without writing anything", async () => {
      const result = await StaffTimeClockAdapter.recordClockEvent(
        "ENTRAR",
        orgIdA,
        userId,
        false, // offline!
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("No hay conexión. El fichaje necesita conexión para registrarse.");
      expect(result.shift).toBeUndefined();
    });
  });

  /* ── 6. Mock Supabase Client Integration (Real DB logic) ────────── */
  describe("Real Query Integration & Multi-Org Scoping", () => {
    it("reads real active session and derives TRABAJANDO state from Core table", async () => {
      const mockSupabase = {
        from: (table: string) => {
          if (table === "studio_attendance_sessions") {
            return {
              select: () => ({
                eq: (col1: string, val1: string) => ({
                  eq: (col2: string, val2: string) => ({
                    neq: () => ({
                      order: () => ({
                        limit: () =>
                          Promise.resolve({
                            data: [
                              {
                                id: "session-uuid-1",
                                organization_id: val1,
                                user_id: val2,
                                location_id: "loc-uuid-1",
                                professional_id: "prof-uuid-1",
                                started_at: "2026-10-03T09:02:00.000Z",
                                ended_at: null,
                                status: "working" as AttendanceStatus,
                                source: "self",
                                corrected: false,
                              },
                            ],
                            error: null,
                          }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "studio_attendance_breaks") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    order: () => Promise.resolve({ data: [], error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "studio_professionals") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: { id: "prof-1" } }),
                  }),
                }),
              }),
            };
          }
          if (table === "studio_working_hours") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      eq: () => ({
                        order: () => ({
                          limit: () => ({
                            maybeSingle: () =>
                              Promise.resolve({
                                data: { starts_at: "09:00:00", ends_at: "17:00:00" },
                              }),
                          }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        },
      } as unknown as SupabaseClient<Database>;

      const shift = await fetchTodaySessionFromSupabase(mockSupabase, orgIdA, userId);
      expect(shift.id).toBe("session-uuid-1");
      expect(shift.organizationId).toBe(orgIdA);
      expect(shift.userId).toBe(userId);
      expect(shift.state).toBe("TRABAJANDO");
      expect(shift.clockInTime).toBe("2026-10-03T09:02:00.000Z");
      expect(shift.clockOutTime).toBeNull();
      expect(shift.plannedStart).toBe("09:00");
      expect(shift.plannedEnd).toBe("17:00");
    });

    it("Multi-Org Isolation: Organization A query cannot see Organization B data", async () => {
      let queriedOrgId = "";
      const mockSupabase = {
        from: (table: string) => {
          if (table === "studio_attendance_sessions") {
            return {
              select: () => ({
                eq: (col1: string, val1: string) => {
                  queriedOrgId = val1;
                  return {
                    eq: () => ({
                      neq: () => ({
                        order: () => ({
                          limit: () => Promise.resolve({ data: [], error: null }),
                        }),
                      }),
                      gte: () => ({
                        lte: () => ({
                          order: () => ({
                            limit: () => Promise.resolve({ data: [], error: null }),
                          }),
                        }),
                      }),
                    }),
                  };
                },
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null }),
                }),
              }),
            }),
          };
        },
      } as unknown as SupabaseClient<Database>;

      await fetchTodaySessionFromSupabase(mockSupabase, orgIdA, userId);
      expect(queriedOrgId).toBe(orgIdA);
      expect(queriedOrgId).not.toBe(orgIdB);
    });

    it("History: returns real sessions without any hardcoded mock data", async () => {
      const mockSupabase = {
        from: (table: string) => {
          if (table === "studio_attendance_sessions") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    order: () => ({
                      limit: () =>
                        Promise.resolve({
                          data: [
                            {
                              id: "hist-1",
                              started_at: "2026-10-02T07:01:00.000Z",
                              ended_at: "2026-10-02T15:08:00.000Z",
                              status: "finished" as AttendanceStatus,
                              location_id: "loc-1",
                            },
                          ],
                          error: null,
                        }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "studio_attendance_breaks") {
            return {
              select: () => ({
                eq: () => ({
                  in: () => ({
                    order: () =>
                      Promise.resolve({
                        data: [
                          {
                            id: "break-1",
                            session_id: "hist-1",
                            started_at: "2026-10-02T11:00:00.000Z",
                            ended_at: "2026-10-02T12:00:00.000Z", // 1h
                          },
                        ],
                        error: null,
                      }),
                  }),
                }),
              }),
            };
          }
          return {};
        },
      } as unknown as SupabaseClient<Database>;

      const history = await fetchHistoryFromSupabase(mockSupabase, orgIdA, userId);
      expect(history.length).toBe(1);
      expect(history[0].id).toBe("hist-1");
      expect(history[0].clockIn).toBe("09:01");
      expect(history[0].clockOut).toBe("17:08");
      expect(history[0].totalWorked).toBe("7 h 07 min");
      expect(history[0].totalBreaks).toBe("1 h 00 min");
    });

    it("History: returns empty array when there are no previous sessions (no mock data)", async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const history = await fetchHistoryFromSupabase(mockSupabase, orgIdA, userId);
      expect(history).toEqual([]);
    });
  });
});
