import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/app/actions/waitlist", () => ({
  bookWaitlistEntryAction: vi.fn(),
  offerWaitlistSlotAction: vi.fn(),
  withdrawWaitlistOfferAction: vi.fn(),
  updateWaitlistEntryAction: vi.fn(),
  removeWaitlistEntryAction: vi.fn(),
  addWaitlistEntryAction: vi.fn(),
  searchClientsAction: vi.fn(async () => ({ success: true, message: "", clients: [] })),
}));

import { WaitlistCard } from "@/components/WaitlistCard";
import { WaitlistBookForm } from "@/components/WaitlistBookForm";
import { WaitlistEntryManager } from "@/components/WaitlistEntryManager";
import { WaitlistIndicator } from "@/components/WaitlistIndicator";
import { bookWaitlistEntryAction } from "@/app/actions/waitlist";
import { parseDepositQuote, parseWaitlistEntry } from "@/lib/kmbook/waitlist-format";

const entry = (over: Record<string, unknown> = {}) =>
  parseWaitlistEntry({
    id: "e1", client_id: "c1", client_name: "Ana", service_id: "s1", service_name: "Manicura", currency: "EUR",
    preferred_days: [], status: "active", source: "staff", created_at: "2026-10-09T08:00:00Z", position: 1, ...over,
  })!;

const quote = (over: Record<string, unknown> = {}) =>
  parseDepositQuote({ enabled: true, total: 40, currency: "EUR", deposit_percent: 30, required: 12, color: null, can_waive: false, can_record: true, ...over });

const formProps = { organizationId: "o", entryId: "e1", clientId: "c1", serviceId: "s1", professionalId: "p1", startsAt: "2026-10-12T09:00:00Z" };

describe("Tablero — tarjeta", () => {
  it("sin color de Core no pinta semáforo ni porcentaje", () => {
    render(<WaitlistCard entry={entry()} />);
    expect(screen.queryByTestId("trust-badge")).toBeNull();
    expect(screen.queryByText(/Clienta (verde|amarilla|roja)/)).toBeNull();
    expect(screen.queryByText(/Depósito aplicable/)).toBeNull();
    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("En cola")).toBeTruthy();
  });

  it("con color de Core lo muestra con texto y porcentaje", () => {
    render(<WaitlistCard entry={entry({ trust_color: "red", deposit_percent: 100 })} />);
    expect(screen.getByText("Clienta roja")).toBeTruthy();
    expect(screen.getByText(/Depósito aplicable: 100 %/)).toBeTruthy();
  });

  it("muestra la oferta con cuenta atrás y la cita pendiente de depósito", () => {
    const future = new Date(Date.now() + 90 * 60000).toISOString();
    render(
      <WaitlistCard
        entry={entry({
          status: "contacted", position: null,
          offer: { id: "o1", status: "pending", starts_at: future, ends_at: future, expires_at: future, professional_name: "Laura", origin: "staff" },
          appointment: { id: "a1", status: "pending", starts_at: future },
        })}
      />,
    );
    expect(screen.getByTestId("offer-countdown").textContent).toMatch(/^Caduca en/);
    expect(screen.getByTestId("linked-appointment").textContent).toContain("no se confirma hasta cubrirlo");
  });
});

describe("Indicador de agenda", () => {
  it("no pinta nada sin acceso (null) ni con 0", () => {
    const { container, rerender } = render(<WaitlistIndicator count={null} />);
    expect(container.innerHTML).toBe("");
    rerender(<WaitlistIndicator count={0} />);
    expect(container.innerHTML).toBe("");
  });
  it("«Lista de espera (N)» enlaza al tablero", () => {
    render(<WaitlistIndicator count={3} />);
    const link = screen.getByTestId("waitlist-indicator");
    expect(link.textContent).toContain("Lista de espera (3)");
    expect(link.getAttribute("href")).toBe("/waitlist");
  });
});

describe("Gestión de la entrada", () => {
  it("nunca ofrece marcar «reservada»", () => {
    render(<WaitlistEntryManager organizationId="o" entry={entry()} professionals={[]} />);
    expect(screen.queryByText(/reservada/i)).toBeNull();
    expect(screen.getByText("Marcar como contactada")).toBeTruthy();
  });
  it("una entrada con cita vinculada no se edita", () => {
    const { container } = render(
      <WaitlistEntryManager organizationId="o" entry={entry({ status: "contacted", appointment: { id: "a1", status: "pending" } })} professionals={[]} />,
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("Reservar desde la lista — formulario", () => {
  it("«Omitir depósito» NO aparece sin can_waive", () => {
    render(<WaitlistBookForm {...formProps} quote={quote({ can_waive: false })} />);
    expect(screen.queryByText("Omitir depósito")).toBeNull();
    expect(screen.getByText("Cobrar el depósito ahora")).toBeTruthy();
  });

  it("«Omitir depósito» aparece con can_waive y exige motivo", () => {
    vi.mocked(bookWaitlistEntryAction).mockClear();
    render(<WaitlistBookForm {...formProps} quote={quote({ can_waive: true })} />);
    fireEvent.click(screen.getByLabelText("Omitir depósito"));
    fireEvent.change(screen.getByLabelText("Motivo de la omisión"), { target: { value: "abc" } });
    fireEvent.submit(screen.getByTestId("book-form"));
    expect(screen.getByRole("alert").textContent).toMatch(/mínimo 5/);
    expect(bookWaitlistEntryAction).not.toHaveBeenCalled();
  });

  it("sin presupuesto de Core no se ofrece omitir y se explica", () => {
    render(<WaitlistBookForm {...formProps} quote={null} />);
    expect(screen.queryByText("Omitir depósito")).toBeNull();
    expect(screen.getByText(/Core calculará el depósito/)).toBeTruthy();
  });

  it("dejar pendiente avisa de que no se confirma y usa la misma clave en reintentos", async () => {
    const mock = vi.mocked(bookWaitlistEntryAction);
    mock.mockClear();
    mock.mockResolvedValue({ success: false, message: "Ese hueco ya no está disponible. Elige otro." });
    render(<WaitlistBookForm {...formProps} quote={quote()} />);
    fireEvent.click(screen.getByLabelText("Dejar la reserva pendiente"));
    expect(screen.getByRole("note").textContent).toContain("La reserva no se confirma hasta cubrir el depósito.");
    fireEvent.submit(screen.getByTestId("book-form"));
    await screen.findByText("Ese hueco ya no está disponible. Elige otro.");
    fireEvent.submit(screen.getByTestId("book-form"));
    await vi.waitFor(() => expect(mock).toHaveBeenCalledTimes(2));
    const keys = mock.mock.calls.map((c) => c[7]);
    expect(keys[0]).toBe(keys[1]);
    expect(String(keys[0]).length).toBeGreaterThanOrEqual(8);
  });

  it("cada formulario nuevo genera su propia clave", async () => {
    const mock = vi.mocked(bookWaitlistEntryAction);
    mock.mockClear();
    mock.mockResolvedValue({ success: false, message: "x" });
    const a = render(<WaitlistBookForm {...formProps} quote={quote()} />);
    fireEvent.click(screen.getByLabelText("Dejar la reserva pendiente"));
    fireEvent.submit(screen.getByTestId("book-form"));
    await vi.waitFor(() => expect(mock).toHaveBeenCalledTimes(1));
    a.unmount();
    render(<WaitlistBookForm {...formProps} quote={quote()} />);
    fireEvent.click(screen.getByLabelText("Dejar la reserva pendiente"));
    fireEvent.submit(screen.getByTestId("book-form"));
    await vi.waitFor(() => expect(mock).toHaveBeenCalledTimes(2));
    expect(mock.mock.calls[0][7]).not.toBe(mock.mock.calls[1][7]);
  });

  it("muestra la cita como pendiente tras reservar sin cobro", async () => {
    vi.mocked(bookWaitlistEntryAction).mockResolvedValue({
      success: true, message: "Reserva creada y pendiente de depósito. La reserva no se confirma hasta cubrir el depósito.",
      appointmentId: "a1", appointmentStatus: "pending",
    });
    render(<WaitlistBookForm {...formProps} quote={quote()} />);
    fireEvent.click(screen.getByLabelText("Dejar la reserva pendiente"));
    fireEvent.submit(screen.getByTestId("book-form"));
    const done = await screen.findByTestId("book-done");
    expect(done.textContent).toContain("no se confirma hasta cubrir el depósito");
  });
});
