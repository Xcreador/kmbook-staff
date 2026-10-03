import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/Button";
import { BottomNav } from "@/components/BottomNav";

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

  it("renders BottomNav with 4 primary tabs and unread badge", () => {
    render(<BottomNav unreadCount={3} />);

    expect(screen.getByText("HOY")).toBeDefined();
    expect(screen.getByText("AGENDA")).toBeDefined();
    expect(screen.getByText("FICHAJE")).toBeDefined();
    expect(screen.getByText("AVISOS")).toBeDefined();

    // Check badge display
    expect(screen.getByText("3")).toBeDefined();
  });
});
