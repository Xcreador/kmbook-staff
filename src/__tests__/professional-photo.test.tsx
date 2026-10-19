import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextRequest } from "next/server";

const { rpc, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
vi.mock("@/lib/kmbook/auth", () => ({ getAuthenticatedUser: getUser }));

import { GET } from "@/app/api/professional-photo/[professionalId]/route";
import { Avatar } from "@/components/Avatar";

const ORG = "11111111-1111-4111-8111-111111111111";
const PRO = "22222222-2222-4222-8222-222222222222";
const call = (qs: string, id = PRO) =>
  GET(new NextRequest(`http://localhost/api/professional-photo/${id}${qs}`), { params: Promise.resolve({ professionalId: id }) });

describe("ST-08 — foto del profesional heredada de Business", () => {
  beforeEach(() => {
    rpc.mockReset();
    getUser.mockReset();
    getUser.mockResolvedValue({ id: "u1", email: null });
  });

  it("lee la foto con la RPC de Business (sin almacenamiento propio) y la sirve con cabeceras seguras", async () => {
    rpc.mockResolvedValue({ data: [{ content_type: "image/webp", data_base64: "AAEC", version: 3 }], error: null });
    const res = await call(`?organization=${ORG}&v=3`);
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("get_studio_professional_photo", { p_organization_id: ORG, p_professional_id: PRO });
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toContain("private");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0, 1, 2]));
  });

  it("sin sesión: 401 y sin consulta", async () => {
    getUser.mockResolvedValue(null);
    expect((await call(`?organization=${ORG}`)).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ids manipulados: 404 sin consulta", async () => {
    expect((await call(`?organization=${ORG}`, "no-uuid")).status).toBe(404);
    expect((await call(`?organization=nope`)).status).toBe(404);
    expect((await call("")).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("otra empresa (la RPC deniega), sin foto o tipo no imagen: 404", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "authorization_required" } });
    expect((await call(`?organization=${ORG}`)).status).toBe(404);
    rpc.mockResolvedValue({ data: [], error: null });
    expect((await call(`?organization=${ORG}`)).status).toBe(404);
    rpc.mockResolvedValue({ data: [{ content_type: "text/html", data_base64: "AAEC", version: 1 }], error: null });
    expect((await call(`?organization=${ORG}`)).status).toBe(404);
  });
});

describe("ST-08 — Avatar", () => {
  it("muestra la foto cuando existe", () => {
    render(<Avatar src="/api/professional-photo/x?organization=y&v=2" name="Bárbara" size={34} className="img" placeholderClassName="ph" />);
    expect(screen.getByRole("img", { name: "Bárbara" }).getAttribute("src")).toContain("v=2");
  });

  it("sin foto usa el avatar genérico", () => {
    const { container } = render(<Avatar src={null} name="Bárbara" size={34} className="img" placeholderClassName="ph" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".ph")).not.toBeNull();
  });

  it("si la imagen falla vuelve al genérico y recupera la foto cuando cambia la URL", () => {
    const { container, rerender } = render(<Avatar src="/a?v=1" name="B" size={34} className="img" placeholderClassName="ph" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".ph")).not.toBeNull();
    rerender(<Avatar src="/a?v=2" name="B" size={34} className="img" placeholderClassName="ph" />);
    expect(container.querySelector("img")).not.toBeNull();
  });
});
