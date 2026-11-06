import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { describeDevice, detectPushSupport, safeTag, staffDestination } from "@/lib/kmbook/push-routing";

// Las mismas funciones copiadas en public/sw.js: se cargan del archivo real para comprobar que no divergen.
const swSource = readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");
const swStart = swSource.indexOf("const STAFF_FALLBACK_URL");
const swEnd = swSource.indexOf('self.addEventListener("push"');
const swFns = new Function(`${swSource.slice(swStart, swEnd)}; return { staffDestination, safeTag };`)() as {
  staffDestination: typeof staffDestination;
  safeTag: typeof safeTag;
};

const APPT = "11111111-1111-4111-8111-111111111111";
const CASES: Array<[string, Parameters<typeof staffDestination>[0], string]> = [
  ["cita de Business → ficha de la cita en Staff", { url: `/app/studio/agenda?organization=o&appointment=${APPT}`, data: { eventType: "appointment.booked_online" } }, `/appointments/${APPT}`],
  ["cita sin id → agenda", { url: "/app/studio/agenda?organization=o", data: { eventType: "appointment.cancelled" } }, "/agenda"],
  ["tarea → hoy", { url: "/app/studio/tasks?organization=o", data: { eventType: "task.assigned" } }, "/today"],
  ["prueba → pantalla de notificaciones", { url: "/app/notifications/push?organization=o", data: { eventType: "push.test" } }, "/profile/push"],
  ["evento desconocido → bandeja", { url: "/app/x", data: { eventType: "shop.order" } }, "/notifications"],
  ["URL externa nunca se usa", { url: "https://evil.example/?appointment=" + APPT, data: { eventType: "other" } }, "/notifications"],
  ["id inyectado no es UUID", { url: "/app/studio/agenda?appointment=../../evil", data: { eventType: "appointment.rescheduled" } }, "/agenda"],
  ["payload vacío", {}, "/notifications"],
];

describe("Staff Push — destino al pulsar", () => {
  for (const [name, payload, expected] of CASES) {
    it(`${name} (TS y Service Worker)`, () => {
      expect(staffDestination(payload)).toBe(expected);
      expect(swFns.staffDestination(payload)).toBe(expected);
    });
  }
  it("toda ruta resultante es relativa y propia", () => {
    for (const [, payload] of CASES) expect(staffDestination(payload)).toMatch(/^\/[a-z]/);
  });
});

describe("Staff Push — etiqueta y compatibilidad", () => {
  it("conserva etiquetas válidas (con guion bajo) y rechaza el resto", () => {
    for (const fn of [safeTag, swFns.safeTag]) {
      expect(fn("kmbook-appointment-booked_online-1082")).toBe("kmbook-appointment-booked_online-1082");
      expect(fn("<script>")).toBe("kmbook-staff-notification");
      expect(fn(undefined)).toBe("kmbook-staff-notification");
    }
  });
  it("iPhone sin instalar: pide instalar la PWA; instalada: compatible", () => {
    const base = { hasServiceWorker: true, hasPushManager: true, hasNotification: true, isSecureContext: true };
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari/604.1";
    expect(detectPushSupport({ ...base, userAgent: ua, isStandalone: false })).toBe("ios_needs_install");
    expect(detectPushSupport({ ...base, userAgent: ua, isStandalone: true })).toBe("supported");
    expect(detectPushSupport({ ...base, hasPushManager: false, userAgent: "Chrome/130", isStandalone: false })).toBe("unsupported");
    expect(detectPushSupport({ ...base, isSecureContext: false, userAgent: "Chrome/130", isStandalone: false })).toBe("insecure_context");
  });
  it("la etiqueta del dispositivo no contiene datos personales y se distingue de Business", () => {
    expect(describeDevice("Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile")).toBe("Staff · Chrome en Android");
  });
});
