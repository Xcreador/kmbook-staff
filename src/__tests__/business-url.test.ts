import { describe, expect, it } from "vitest";
import { buildBusinessUrl, getBusinessOrigin, parseBusinessOrigin } from "@/lib/kmbook/business-url";

describe("parseBusinessOrigin", () => {
  it("acepta https válido y lo normaliza a origin", () => {
    expect(parseBusinessOrigin("https://business.example.com", "production")).toBe("https://business.example.com");
    expect(parseBusinessOrigin("  https://Business.Example.com/  ", "production")).toBe("https://business.example.com");
  });

  it.each([
    ["ausente", undefined],
    ["vacía", ""],
    ["solo espacios", "   "],
    ["no es URL", "business"],
    ["http en producción", "http://business.example.com"],
    ["con credenciales", "https://user:pass@business.example.com"],
    ["solo usuario", "https://user@business.example.com"],
    ["con ruta", "https://business.example.com/app"],
    ["con consulta", "https://business.example.com/?a=1"],
    ["con consulta vacía", "https://business.example.com?"],
    ["con fragmento", "https://business.example.com/#x"],
    ["con puerto", "https://business.example.com:8443"],
    ["IP", "https://203.0.113.10"],
    ["IPv6", "https://[::1]"],
    ["host de una etiqueta", "https://business"],
    ["host con guion bajo", "https://bus_iness.example.com"],
    ["esquema javascript", "javascript:alert(1)"],
    ["esquema ftp", "ftp://business.example.com"],
    ["barra invertida", "https://business.example.com\\evil.com"],
    ["localhost en producción", "http://localhost:3000"],
    ["localhost https en producción", "https://localhost"],
  ])("rechaza (%s)", (_name, raw) => {
    expect(parseBusinessOrigin(raw as string | undefined, "production")).toBeNull();
  });

  it("http solo para localhost fuera de producción", () => {
    expect(parseBusinessOrigin("http://localhost:3000", "development")).toBe("http://localhost:3000");
    expect(parseBusinessOrigin("http://127.0.0.1:3000", "development")).toBe("http://127.0.0.1:3000");
    expect(parseBusinessOrigin("http://business.example.com", "development")).toBeNull();
  });
});

describe("getBusinessOrigin / buildBusinessUrl", () => {
  it("lee KMBOOK_BUSINESS_URL y cae en NEXT_PUBLIC_BUSINESS_URL por compatibilidad", () => {
    const prev = { a: process.env.KMBOOK_BUSINESS_URL, b: process.env.NEXT_PUBLIC_BUSINESS_URL };
    try {
      delete process.env.KMBOOK_BUSINESS_URL;
      process.env.NEXT_PUBLIC_BUSINESS_URL = "https://legacy.example.com";
      expect(getBusinessOrigin()).toBe("https://legacy.example.com");
      process.env.KMBOOK_BUSINESS_URL = "https://business.example.com";
      expect(getBusinessOrigin()).toBe("https://business.example.com");
      delete process.env.KMBOOK_BUSINESS_URL;
      delete process.env.NEXT_PUBLIC_BUSINESS_URL;
      expect(getBusinessOrigin()).toBeNull();
    } finally {
      if (prev.a === undefined) delete process.env.KMBOOK_BUSINESS_URL; else process.env.KMBOOK_BUSINESS_URL = prev.a;
      if (prev.b === undefined) delete process.env.NEXT_PUBLIC_BUSINESS_URL; else process.env.NEXT_PUBLIC_BUSINESS_URL = prev.b;
    }
  });

  it("construye la URL exacta o null sin origen (sin URL por defecto)", () => {
    expect(buildBusinessUrl("/app/studio/pos", "https://business.example.com")).toBe("https://business.example.com/app/studio/pos");
    expect(buildBusinessUrl("/app/studio", "https://business.example.com")).toBe("https://business.example.com/app/studio");
    expect(buildBusinessUrl("/app/studio/pos", null)).toBeNull();
  });
});
