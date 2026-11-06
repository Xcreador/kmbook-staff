import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let viewer: { activeOrganization: { id: string } | null } | null = { activeOrganization: { id: ORG_A } };

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/kmbook/auth", () => ({ getStaffViewerContext: async () => viewer }));

import {
  revokeStaffPushDeviceAction,
  sendStaffPushTestAction,
  subscribeStaffPushAction,
  unsubscribeStaffPushAction,
} from "@/app/actions/push";
import { releasePushDevice, releasePushDeviceIfOrganizationChanges } from "@/lib/kmbook/push-device";

const SUB = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc-device-0001",
  p256dh: "B" + "A".repeat(86),
  auth: "a".repeat(22),
};

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  cookieStore.get.mockReset();
  cookieStore.set.mockReset();
  cookieStore.delete.mockReset();
  viewer = { activeOrganization: { id: ORG_A } };
});

describe("Staff Push — alta y baja en el servidor", () => {
  it("registra en la organización ACTIVA verificada, nunca en una que llegue del navegador", async () => {
    const forged = { ...SUB, organizationId: "org-ajena" } as typeof SUB;
    const result = await subscribeStaffPushAction(forged);
    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("register_push_subscription", expect.objectContaining({ p_organization_id: ORG_A }));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("org-ajena");
  });

  it("guarda sólo el hash del endpoint en una cookie httpOnly", async () => {
    await subscribeStaffPushAction(SUB);
    const [name, value, options] = cookieStore.set.mock.calls[0];
    expect(name).toBe("kmbook_staff_push_device");
    expect(value).toMatch(new RegExp(`^${ORG_A}:[0-9a-f]{64}$`));
    expect(value).not.toContain("fcm");
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax" });
  });

  it("sin negocio activo no registra nada", async () => {
    viewer = { activeOrganization: null };
    expect((await subscribeStaffPushAction(SUB)).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sin sesión no da de baja ni revoca", async () => {
    viewer = null;
    expect((await unsubscribeStaffPushAction(SUB.endpoint)).ok).toBe(false);
    expect((await revokeStaffPushDeviceAction("11111111-1111-4111-8111-111111111111")).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rechaza suscripciones mal formadas antes de llegar a Core", async () => {
    expect((await subscribeStaffPushAction({ ...SUB, endpoint: "no-es-url" })).ok).toBe(false);
    expect((await subscribeStaffPushAction({ ...SUB, p256dh: "<script>" })).ok).toBe(false);
    expect((await revokeStaffPushDeviceAction("1; drop table")).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("traduce errores de Core sin exponer detalles internos", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "push_device_limit_reached" } });
    const result = await subscribeStaffPushAction(SUB);
    expect(result).toEqual({ ok: false, message: expect.stringContaining("10 dispositivos") });
  });

  it("la prueba usa la organización activa y avisa de que está en cola", async () => {
    const result = await sendStaffPushTestAction();
    expect(rpc).toHaveBeenCalledWith("request_push_test", { p_organization_id: ORG_A });
    expect(result).toMatchObject({ ok: true, message: expect.stringContaining("en cola") });
  });
});

describe("Staff Push — cierre de sesión y cambio de negocio", () => {
  it("da de baja el dispositivo por hash y borra la cookie", async () => {
    cookieStore.get.mockReturnValue({ value: `${ORG_A}:${"a".repeat(64)}` });
    expect(await releasePushDevice()).toBe("released");
    expect(rpc).toHaveBeenCalledWith("unregister_push_subscription_by_hash", { p_endpoint_hash: "a".repeat(64) });
    expect(cookieStore.delete).toHaveBeenCalledWith("kmbook_staff_push_device");
  });

  it("sin cookie o con un valor manipulado no llama a Core", async () => {
    cookieStore.get.mockReturnValue({ value: "' or 1=1 --" });
    await releasePushDevice();
    cookieStore.get.mockReturnValue(undefined);
    await releasePushDevice();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("un fallo de Core nunca bloquea el cierre de sesión", async () => {
    cookieStore.get.mockReturnValue({ value: `${ORG_A}:${"b".repeat(64)}` });
    rpc.mockRejectedValueOnce(new Error("network"));
    await expect(releasePushDevice()).resolves.toBe("failed");
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(releasePushDevice()).resolves.toBe("failed");
    // La cookie se conserva para poder reintentar; nunca se da por hecha una baja fallida.
    expect(cookieStore.delete).not.toHaveBeenCalled();
  });
});

describe("Staff Push — cambio directo entre organizaciones", () => {
  it("A → B: da de baja el dispositivo suscrito a A", async () => {
    cookieStore.get.mockReturnValue({ value: `${ORG_A}:${"c".repeat(64)}` });
    expect(await releasePushDeviceIfOrganizationChanges(ORG_B)).toBe("released");
    expect(rpc).toHaveBeenCalledWith("unregister_push_subscription_by_hash", { p_endpoint_hash: "c".repeat(64) });
  });

  it("A → A: no toca la suscripción", async () => {
    cookieStore.get.mockReturnValue({ value: `${ORG_A}:${"c".repeat(64)}` });
    expect(await releasePushDeviceIfOrganizationChanges(ORG_A)).toBe("none");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("A → B con Core caído: informa del fallo sin lanzar (el cambio de negocio sigue)", async () => {
    cookieStore.get.mockReturnValue({ value: `${ORG_A}:${"c".repeat(64)}` });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "timeout" } });
    await expect(releasePushDeviceIfOrganizationChanges(ORG_B)).resolves.toBe("failed");
  });

  it("cookie antigua sin organización o manipulada: no se usa", async () => {
    cookieStore.get.mockReturnValue({ value: "d".repeat(64) });
    expect(await releasePushDeviceIfOrganizationChanges(ORG_B)).toBe("none");
    expect(await releasePushDevice()).toBe("none");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("Staff Push — desactivación", () => {
  it("si Core falla, la baja NO se declara correcta y la cookie se conserva", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "network" } });
    const result = await unsubscribeStaffPushAction(SUB.endpoint);
    expect(result).toEqual({ ok: false, message: "No se pudo confirmar la baja en el servidor." });
    expect(cookieStore.delete).not.toHaveBeenCalled();
  });

  it("baja confirmada: borra la cookie", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect((await unsubscribeStaffPushAction(SUB.endpoint)).ok).toBe(true);
    expect(cookieStore.delete).toHaveBeenCalledWith("kmbook_staff_push_device");
  });

  it("revocar otro dispositivo exige un id válido; Core sólo revoca filas propias", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await revokeStaffPushDeviceAction("11111111-1111-4111-8111-111111111111");
    expect(rpc).toHaveBeenCalledWith("revoke_my_push_subscription", { p_subscription_id: "11111111-1111-4111-8111-111111111111" });
  });
});
