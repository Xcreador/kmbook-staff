import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/Button";
import { BottomNav } from "@/components/BottomNav";
import { CurrentServiceCard } from "@/components/CurrentServiceCard";
import type { StaffVisit } from "@/lib/kmbook/today";

describe("KMBOOK Staff — Component System Tests", () => {
  it("renders StatusPill for each Core status with accessible labels", () => {
    const { rerender } = render(<StatusPill status="pending" />);
    expect(screen.getByText("Pendiente")).toBeDefined();

    rerender(<StatusPill status="confirmed" />);
    expect(screen.getByText("Confirmada")).toBeDefined();

    rerender(<StatusPill status="in_service" />);
    expect(screen.getByText("En servicio")).toBeDefined();

    rerender(<StatusPill status="finished" />);
    expect(screen.getByText("Completada")).toBeDefined();

    rerender(<StatusPill status="cancelled" />);
    expect(screen.getByText("Cancelada")).toBeDefined();
  });

  it("renders Button component with variant and loading state", () => {
    const { rerender } = render(<Button variant="accent">Iniciar servicio</Button>);
    const btn = screen.getByRole("button", { name: /Iniciar servicio/i });
    expect(btn).toBeDefined();

    rerender(<Button variant="accent" isLoading>Iniciar servicio</Button>);
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("renders BottomNav with 4 primary tabs when time-clock is disabled (default)", () => {
    render(<BottomNav unreadCount={3} timeClockEnabled={false} />);

    expect(screen.getByText("MI JORNADA")).toBeDefined();
    expect(screen.getByText("AGENDA")).toBeDefined();
    expect(screen.getByText("AVISOS")).toBeDefined();
    expect(screen.getByText("PERFIL")).toBeDefined();
    expect(screen.queryByText("FICHAJE")).toBeNull();

    // Check badge display
    expect(screen.getByText("3")).toBeDefined();
  });

  it("renders BottomNav with FICHAJE when time-clock is enabled by organization", () => {
    render(<BottomNav unreadCount={0} timeClockEnabled={true} />);

    expect(screen.getByText("MI JORNADA")).toBeDefined();
    expect(screen.getByText("AGENDA")).toBeDefined();
    expect(screen.getByText("FICHAJE")).toBeDefined();
    expect(screen.getByText("AVISOS")).toBeDefined();
    expect(screen.queryByText("PERFIL")).toBeNull();
  });

  it("renders CurrentServiceCard for arrived client with INICIAR SERVICIO button", () => {
    const mockVisit: StaffVisit = {
      appointmentId: "appt-current-1",
      startsAt: "2026-10-03T17:30:00Z",
      endsAt: "2026-10-03T18:15:00Z",
      clientName: "María López",
      teamNotes: "Uñas sensibles",
      status: "arrived",
      serviceSummary: "Manicura rusa + refuerzo",
      totalDurationMinutes: 45,
      isRunning: false,
      isFinished: false,
      isPending: false,
      items: [
        {
          itemId: "item-1",
          serviceName: "Manicura rusa + refuerzo",
          durationMinutes: 45,
          actualStartedAt: null,
          actualFinishedAt: null,
          actualDurationSeconds: null,
          isExecutable: true,
          isRunning: false,
          isDone: false,
        },
      ],
    };

    render(<CurrentServiceCard visit={mockVisit} organizationId="org-123" />);

    expect(screen.getByText("María López")).toBeDefined();
    expect(screen.getByText("Manicura rusa + refuerzo")).toBeDefined();
    expect(screen.getByRole("button", { name: /INICIAR SERVICIO/i })).toBeDefined();
  });

  it("renders CurrentServiceCard for active in-service appointment with FINALIZAR button", () => {
    const mockVisit: StaffVisit = {
      appointmentId: "appt-active-2",
      startsAt: "2026-10-03T17:30:00Z",
      endsAt: "2026-10-03T18:15:00Z",
      clientName: "Elena Ramos",
      teamNotes: null,
      status: "in_service",
      serviceSummary: "Tratamiento hidratante",
      totalDurationMinutes: 45,
      isRunning: true,
      isFinished: false,
      isPending: false,
      items: [
        {
          itemId: "item-2",
          serviceName: "Tratamiento hidratante",
          durationMinutes: 45,
          actualStartedAt: "2026-10-03T17:35:00Z",
          actualFinishedAt: null,
          actualDurationSeconds: null,
          isExecutable: false,
          isRunning: true,
          isDone: false,
        },
      ],
    };

    render(<CurrentServiceCard visit={mockVisit} organizationId="org-123" />);

    expect(screen.getByText("Elena Ramos")).toBeDefined();
    expect(screen.getByRole("button", { name: /FINALIZAR SERVICIO/i })).toBeDefined();
    expect(screen.getByText(/EN SERVICIO/i)).toBeDefined();
  });

  const baseVisit = (over: Partial<StaffVisit>, items: StaffVisit["items"]): StaffVisit => ({
    appointmentId: "appt-x",
    startsAt: "2026-10-03T17:30:00Z",
    endsAt: "2026-10-03T18:15:00Z",
    clientName: "Cliente QA",
    teamNotes: null,
    status: "arrived",
    serviceSummary: "Servicios",
    totalDurationMinutes: 60,
    isRunning: false,
    isFinished: false,
    isPending: false,
    items,
    ...over,
  });
  const item = (id: string, over: Partial<StaffVisit["items"][number]> = {}) => ({
    itemId: id, serviceName: `Servicio ${id}`, durationMinutes: 30, actualStartedAt: null, actualFinishedAt: null,
    actualDurationSeconds: null, isExecutable: true, isRunning: false, isDone: false, ...over,
  });

  it("una cita confirmada (clienta aún no llegada) NO ofrece Iniciar: espera la llegada", () => {
    render(<CurrentServiceCard visit={baseVisit({ status: "confirmed" }, [item("a")])} organizationId="org-123" />);
    expect(screen.queryByRole("button", { name: /INICIAR SERVICIO/i })).toBeNull();
    expect(screen.getByTestId("awaiting-arrival")).toBeDefined();
  });

  it("multi-servicio en curso: tras terminar el 1.º ofrece Iniciar el 2.º (no un Finalizar muerto)", () => {
    const visit = baseVisit({ status: "in_service", isRunning: true }, [
      item("a", { isDone: true, actualStartedAt: "2026-10-03T17:30:00Z", actualFinishedAt: "2026-10-03T17:55:00Z" }),
      item("b"),
    ]);
    render(<CurrentServiceCard visit={visit} organizationId="org-123" />);
    expect(screen.getByRole("button", { name: /INICIAR SERVICIO/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /FINALIZAR SERVICIO/i })).toBeNull();
  });
});
