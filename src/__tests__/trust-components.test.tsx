import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppointmentCard } from "@/components/AppointmentCard";
import { DepositPanel } from "@/components/DepositPanel";
import { TrustBadge } from "@/components/TrustBadge";
import { parseAppointmentDeposit } from "@/lib/kmbook/trust-format";
import type { StaffVisit } from "@/lib/kmbook/today";

const visit: StaffVisit = {
  appointmentId: "a1",
  status: "pending",
  startsAt: "2026-10-12T09:00:00Z",
  endsAt: "2026-10-12T10:00:00Z",
  clientName: "Ana",
  teamNotes: null,
  items: [],
  totalDurationMinutes: 60,
  serviceSummary: "Manicura",
  isRunning: false,
  isFinished: false,
  isPending: true,
};

const dep = (over: Record<string, unknown> = {}) =>
  parseAppointmentDeposit({
    has_terms: true,
    trust_color: "red",
    deposit_percent: 100,
    currency: "EUR",
    total: 50,
    required: 50,
    paid: 0,
    waived: false,
    waived_amount: null,
    waived_reason: null,
    satisfied: false,
    deposit_pending: 50,
    balance_due: 50,
    ...over,
  });

describe("Semáforo y depósito — componentes", () => {
  it("tarjeta sin capacidad (trust null): no pinta indicador", () => {
    render(<AppointmentCard visit={visit} />);
    expect(screen.queryByTestId("trust-badge")).toBeNull();
    expect(screen.queryByText(/Clienta (verde|amarilla|roja)/)).toBeNull();
  });

  it("tarjeta con semáforo apagado (sin color ni depósito): no pinta nada", () => {
    render(<AppointmentCard visit={visit} trust={{ color: null, pendingLabel: null }} />);
    expect(screen.queryByTestId("trust-badge")).toBeNull();
  });

  it("tarjeta con capacidad: texto accesible por color, no sólo color", () => {
    const { rerender } = render(<AppointmentCard visit={visit} trust={{ color: "green", pendingLabel: null }} />);
    expect(screen.getByText("Clienta verde")).toBeDefined();
    rerender(<AppointmentCard visit={visit} trust={{ color: "yellow", pendingLabel: null }} />);
    expect(screen.getByText("Clienta amarilla")).toBeDefined();
    rerender(<AppointmentCard visit={visit} trust={{ color: "red", pendingLabel: "50,00 €" }} />);
    expect(screen.getByText("Clienta roja")).toBeDefined();
    expect(screen.getByText(/Depósito pendiente: 50,00/)).toBeDefined();
  });

  it("detalle: sin datos (sin capacidad / RPC ausente) no renderiza nada", () => {
    const { container } = render(<DepositPanel deposit={null} />);
    expect(container.innerHTML).toBe("");
    const { container: c2 } = render(<DepositPanel deposit={dep({ has_terms: false })} />);
    expect(c2.innerHTML).toBe("");
  });

  it("detalle: depósito pendiente muestra aviso y no ofrece confirmar", () => {
    render(<DepositPanel deposit={dep()} appointmentStatus="pending" />);
    expect(screen.getByRole("alert").textContent).toMatch(/Depósito pendiente: 50,00/);
    expect(screen.getByText("Depósito exigido")).toBeDefined();
    expect(screen.getByText("Saldo pendiente")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/^Confirmar/i)).toBeNull();
  });

  it("detalle: depósito cubierto no muestra aviso", () => {
    render(<DepositPanel deposit={dep({ satisfied: true, paid: 50, deposit_pending: 0, balance_due: 0 })} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Cobrado")).toBeDefined();
  });

  it("detalle: omisión muestra el texto y el motivo sólo si llega", () => {
    const { rerender } = render(
      <DepositPanel deposit={dep({ waived: true, satisfied: true, deposit_pending: 0, waived_reason: "Clienta de confianza" })} />,
    );
    expect(screen.getByText("Depósito omitido por excepción autorizada")).toBeDefined();
    expect(screen.getByText(/Motivo: Clienta de confianza/)).toBeDefined();
    rerender(<DepositPanel deposit={dep({ waived: true, satisfied: true, deposit_pending: 0, waived_reason: null })} />);
    expect(screen.getByText("Depósito omitido por excepción autorizada")).toBeDefined();
    expect(screen.queryByText(/Motivo:/)).toBeNull();
  });

  it("detalle: cita no pendiente (p. ej. cancelada) no muestra aviso de pendiente", () => {
    render(<DepositPanel deposit={dep()} appointmentStatus="cancelled" />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("TrustBadge sin color ni pendiente devuelve null", () => {
    const { container } = render(<TrustBadge color={null} />);
    expect(container.innerHTML).toBe("");
  });
});
