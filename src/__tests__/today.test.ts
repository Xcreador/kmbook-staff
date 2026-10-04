import { describe, it, expect } from "vitest";
import { groupIntoVisits, getGreeting, formatDateSpanish, type ProfessionalDayRow } from "@/lib/kmbook/today";

describe("KMBOOK Staff — Today Domain Unit Tests", () => {
  it("determines correct salutation based on the hour of the day", () => {
    expect(getGreeting(8)).toBe("Buenos días");
    expect(getGreeting(12)).toBe("Buenos días");
    expect(getGreeting(15)).toBe("Buenas tardes");
    expect(getGreeting(19)).toBe("Buenas tardes");
    expect(getGreeting(21)).toBe("Buenas noches");
  });

  it("formats date in friendly Spanish format", () => {
    const fixedDate = new Date("2026-10-03T10:00:00Z");
    const formatted = formatDateSpanish(fixedDate);
    expect(formatted.toLowerCase()).toContain("octubre");
  });

  it("groups multi-item services under a single visit preserving chronologic order", () => {
    const mockRows: ProfessionalDayRow[] = [
      {
        appointment_id: "appt-1",
        item_id: "item-1",
        status: "confirmed",
        starts_at: "2026-10-03T09:00:00Z",
        ends_at: "2026-10-03T09:45:00Z",
        service_name: "Manicura Rusa",
        professional_name: "Barbara",
        scheduled_duration_minutes: 45,
        actual_started_at: null,
        actual_finished_at: null,
        actual_duration_seconds: null,
        client_name: "María Gómez",
        client_team_notes: "Prefiere café solo",
      },
      {
        appointment_id: "appt-1",
        item_id: "item-2",
        status: "confirmed",
        starts_at: "2026-10-03T09:45:00Z",
        ends_at: "2026-10-03T10:15:00Z",
        service_name: "Nail Art",
        professional_name: "Barbara",
        scheduled_duration_minutes: 30,
        actual_started_at: null,
        actual_finished_at: null,
        actual_duration_seconds: null,
        client_name: "María Gómez",
        client_team_notes: "Prefiere café solo",
      },
      {
        appointment_id: "appt-2",
        item_id: "item-3",
        status: "arrived",
        starts_at: "2026-10-03T11:00:00Z",
        ends_at: "2026-10-03T12:00:00Z",
        service_name: "Pedicura Spa",
        professional_name: "Barbara",
        scheduled_duration_minutes: 60,
        actual_started_at: null,
        actual_finished_at: null,
        actual_duration_seconds: null,
        client_name: "Laura Vidal",
        client_team_notes: null,
      },
    ];

    const visits = groupIntoVisits(mockRows);

    expect(visits).toHaveLength(2);
    expect(visits[0].appointmentId).toBe("appt-1");
    expect(visits[0].items).toHaveLength(2);
    expect(visits[0].totalDurationMinutes).toBe(75);
    expect(visits[0].serviceSummary).toBe("Manicura Rusa, Nail Art");
    expect(visits[0].clientName).toBe("María Gómez");

    expect(visits[1].appointmentId).toBe("appt-2");
    expect(visits[1].items).toHaveLength(1);
    expect(visits[1].totalDurationMinutes).toBe(60);
  });

  it("accurately marks running state when actual_started_at is present without finished date", () => {
    const mockRunning: ProfessionalDayRow[] = [
      {
        appointment_id: "appt-run",
        item_id: "item-run",
        status: "in_service",
        starts_at: "2026-10-03T10:00:00Z",
        ends_at: "2026-10-03T11:00:00Z",
        service_name: "Coloración",
        professional_name: "Barbara",
        scheduled_duration_minutes: 60,
        actual_started_at: "2026-10-03T10:02:00Z",
        actual_finished_at: null,
        actual_duration_seconds: null,
        client_name: "Carmen Sanz",
        client_team_notes: null,
      },
    ];

    const visits = groupIntoVisits(mockRunning);
    expect(visits[0].isRunning).toBe(true);
    expect(visits[0].items[0].isRunning).toBe(true);
    expect(visits[0].items[0].isDone).toBe(false);
  });
});
