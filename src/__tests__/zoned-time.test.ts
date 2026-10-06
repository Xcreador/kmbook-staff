import { describe, expect, it } from "vitest";

import { zonedDateString, zonedDayBoundsIso, zonedHour } from "@/lib/kmbook/zoned-time";

describe("fecha y hora en la zona de la organización", () => {
  it("entre 00:00 y 02:00 de Madrid «hoy» ya es el día siguiente al UTC", () => {
    const at = new Date("2026-10-05T22:30:00Z"); // 00:30 del 6/oct en Madrid (CEST)
    expect(at.toISOString().slice(0, 10)).toBe("2026-10-05");
    expect(zonedDateString("Europe/Madrid", at)).toBe("2026-10-06");
    expect(zonedHour("Europe/Madrid", at)).toBe(0);
  });

  it("límites del día local: verano (+02:00)", () => {
    expect(zonedDayBoundsIso("Europe/Madrid", "2026-10-06")).toEqual({
      startIso: "2026-10-05T22:00:00.000Z",
      endIso: "2026-10-06T21:59:59.999Z",
    });
  });

  it("el día del cambio de hora dura 25 h (fin del horario de verano)", () => {
    const { startIso, endIso } = zonedDayBoundsIso("Europe/Madrid", "2026-10-25");
    expect(startIso).toBe("2026-10-24T22:00:00.000Z");
    expect(endIso).toBe("2026-10-25T22:59:59.999Z");
  });

  it("una zona inválida cae a Europe/Madrid, no rompe", () => {
    expect(zonedDateString("No/Existe", new Date("2026-10-05T22:30:00Z"))).toBe("2026-10-06");
  });
});
