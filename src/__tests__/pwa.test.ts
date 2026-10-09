import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import manifest from "@/app/manifest";

const PUBLIC = path.resolve(__dirname, "../../public");

function pngSize(file: string) {
  const buf = readFileSync(file);
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe("manifest PWA", () => {
  const m = manifest();

  it("campos obligatorios e identidad KMBOOK", () => {
    expect(m.name).toBe("KMBOOK Staff");
    expect(m.short_name).toBeTruthy();
    expect(m.display).toBe("standalone");
    expect(m.id).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.lang).toBe("es");
    expect(m.theme_color).toBe("#070023"); // --km-oxford
    expect(m.background_color).toBe("#F5F5F8"); // --km-niebla
    const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
    expect(css).toContain("--km-oxford: #070023");
    expect(css).toContain("--km-niebla: #F5F5F8");
  });

  it("start_url dentro del scope y que decide el destino (no /today directo)", () => {
    const start = new URL(m.start_url!, "https://staff.example.com");
    expect(start.pathname.startsWith(m.scope!)).toBe(true);
    expect(start.pathname).toBe("/");
  });

  it("iconos 192/512 y maskable existen con el tamaño real declarado", () => {
    const icons = m.icons!;
    expect(icons.some((i) => i.sizes === "192x192" && i.purpose === "any")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "any")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
    for (const icon of icons) {
      const { w, h } = pngSize(path.join(PUBLIC, icon.src));
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
  });

  it("apple-touch-icon 180x180 existe", () => {
    expect(pngSize(path.join(PUBLIC, "icons/apple-touch-icon.png"))).toEqual({ w: 180, h: 180 });
  });
});

describe("layout · meta tags iPhone", () => {
  it("apple web app, viewport-fit y themeColor", async () => {
    vi.mock("@/components/ConnectivityProvider", () => ({ ConnectivityProvider: ({ children }: { children: unknown }) => children }));
    const layout = await import("@/app/layout");
    expect(layout.metadata.appleWebApp).toMatchObject({ capable: true, title: "KMBOOK Staff" });
    expect(layout.metadata.icons).toMatchObject({ apple: [{ url: "/icons/apple-touch-icon.png" }] });
    expect(layout.metadata.manifest).toBe("/manifest.webmanifest");
    expect(layout.viewport).toMatchObject({ viewportFit: "cover", themeColor: "#070023" });
  });
});

/** Carga public/sw.js en un sandbox con un `self` simulado. */
function loadServiceWorker() {
  const listeners: Record<string, (e: unknown) => void> = {};
  const deleted: string[] = [];
  const self = {
    location: { origin: "https://staff.example.com" },
    addEventListener: (type: string, cb: (e: unknown) => void) => { listeners[type] = cb; },
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(async () => undefined),
      matchAll: vi.fn(async () => [] as unknown[]),
      openWindow: vi.fn(async () => undefined),
    },
    registration: { showNotification: vi.fn() },
  };
  const caches = {
    open: async () => ({ addAll: async () => undefined, put: async () => undefined }),
    keys: async () => ["kmbook-staff-v1", "kmbook-staff-v2", "otra"],
    delete: async (k: string) => { deleted.push(k); return true; },
    match: async () => undefined,
  };
  vm.runInNewContext(readFileSync(path.join(PUBLIC, "sw.js"), "utf8"), { self, caches, URL, Response, fetch: vi.fn(), console });
  return { self, listeners, deleted };
}

async function click(url: unknown, existingClients: unknown[] = []) {
  const sw = loadServiceWorker();
  sw.self.clients.matchAll.mockResolvedValue(existingClients);
  let pending: Promise<unknown> = Promise.resolve();
  sw.listeners.notificationclick({
    notification: { close: vi.fn(), data: url === undefined ? undefined : { url } },
    waitUntil: (p: Promise<unknown>) => { pending = p; },
  });
  await pending;
  return sw;
}

describe("service worker", () => {
  it("al activar borra las cachés antiguas y toma el control", async () => {
    const sw = loadServiceWorker();
    let pending: Promise<unknown> = Promise.resolve();
    sw.listeners.activate({ waitUntil: (p: Promise<unknown>) => { pending = p; } });
    await pending;
    expect(sw.deleted.sort()).toEqual(["kmbook-staff-v1", "otra"]);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it("nunca cachea navegación ni RSC/API (respuesta siempre de red)", () => {
    const source = readFileSync(path.join(PUBLIC, "sw.js"), "utf8");
    expect(source).toMatch(/isNavigation[\s\S]*fetch\(event\.request\)/);
    expect(source).not.toMatch(/cache\.put\(event\.request[\s\S]{0,80}navigate/);
  });

  it.each([
    ["/appointments/abc-123", "/appointments/abc-123"],
    ["/waitlist/w-1", "/waitlist/w-1"],
    ["/waitlist/w-1/book?x=1", "/waitlist/w-1/book?x=1"],
    ["https://staff.example.com/agenda?date=2026-10-09", "/agenda?date=2026-10-09"],
    ["https://evil.example.com/appointments/1", "/today"],
    ["//evil.example.com/appointments/1", "/today"],
    ["/\\evil.example.com", "/today"],
    ["/app/studio/pos", "/today"],
    ["/appointments", "/today"],
    [undefined, "/today"],
  ])("deep link %s → %s", async (raw, expected) => {
    const sw = await click(raw);
    expect(sw.self.clients.openWindow).toHaveBeenCalledWith(expected);
  });

  it("con la app abierta, navega ese cliente y lo enfoca", async () => {
    const focused = vi.fn();
    const client = { url: "https://staff.example.com/today", focus: focused, navigate: vi.fn(async () => ({ focus: focused })) };
    const sw = await click("/appointments/xyz", [client]);
    expect(client.navigate).toHaveBeenCalledWith("/appointments/xyz");
    expect(focused).toHaveBeenCalled();
    expect(sw.self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("si navigate() rechaza, abre ventana como respaldo", async () => {
    const client = { url: "https://staff.example.com/today", focus: vi.fn(), navigate: vi.fn(async () => { throw new Error("nope"); }) };
    const sw = await click("/waitlist/w-9", [client]);
    expect(sw.self.clients.openWindow).toHaveBeenCalledWith("/waitlist/w-9");
  });
});
