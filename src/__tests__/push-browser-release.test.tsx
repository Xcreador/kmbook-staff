import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { releaseMock } = vi.hoisted(() => ({ releaseMock: vi.fn() }));
vi.mock("@/lib/kmbook/push", async (orig) => ({ ...(await orig<typeof import("@/lib/kmbook/push")>()), releaseBrowserPush: releaseMock }));

import { releaseBrowserPush as realRelease } from "@/lib/kmbook/push";
import { PushSafeForm } from "@/components/PushSafeForm";

const { releaseBrowserPush } = await vi.importActual<typeof import("@/lib/kmbook/push")>("@/lib/kmbook/push");

describe("releaseBrowserPush", () => {
  it("anula la suscripción del navegador", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    expect(await releaseBrowserPush(async () => ({ unsubscribe }) as unknown as PushSubscription)).toBe("released");
    expect(unsubscribe).toHaveBeenCalled();
  });
  it("sin suscripción: nada que hacer", async () => {
    expect(await releaseBrowserPush(async () => null)).toBe("none");
  });
  it("si el navegador falla o no responde, devuelve «failed» sin bloquear", async () => {
    expect(await releaseBrowserPush(async () => { throw new Error("x"); })).toBe("failed");
    expect(await releaseBrowserPush(() => new Promise(() => undefined), 20)).toBe("failed");
  });
  it("el módulo exporta la función real", () => {
    expect(typeof realRelease).toBe("function");
  });
});

describe("PushSafeForm", () => {
  it("anula la suscripción del navegador ANTES de enviar la acción, y la envía aunque falle", async () => {
    const order: string[] = [];
    releaseMock.mockImplementation(async () => { order.push("release"); return "failed"; });
    const action = vi.fn(async () => { order.push("action"); });
    const { getByRole } = render(<PushSafeForm action={action}><button type="submit">Salir</button></PushSafeForm>);
    fireEvent.submit(getByRole("button").closest("form")!);
    await vi.waitFor(() => expect(action).toHaveBeenCalled());
    expect(order).toEqual(["release", "action"]);
  });
  it("con releasePush=false (mismo negocio) no toca la suscripción", async () => {
    releaseMock.mockClear();
    const action = vi.fn(async () => undefined);
    const { getByRole } = render(<PushSafeForm action={action} releasePush={false}><button type="submit">Entrar</button></PushSafeForm>);
    fireEvent.submit(getByRole("button").closest("form")!);
    await vi.waitFor(() => expect(action).toHaveBeenCalled());
    expect(releaseMock).not.toHaveBeenCalled();
  });
});
