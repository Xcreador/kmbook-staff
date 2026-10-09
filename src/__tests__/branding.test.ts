import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import manifest from "@/app/manifest";

const publicFile = (rel: string) => path.join(process.cwd(), "public", rel);

describe("Branding oficial KMBOOK Staff", () => {
  it("el manifest usa nombre, colores e iconos oficiales", () => {
    const data = manifest();
    expect(data.name).toBe("KMBOOK Staff");
    expect(data.short_name).toBe("Staff");
    expect(data.theme_color).toBe("#070023");
    const icons = data.icons ?? [];
    expect(icons.map((i) => i.src)).toEqual([
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon-512-maskable.png",
    ]);
    expect(icons.map((i) => i.sizes)).toEqual(["192x192", "512x512", "512x512"]);
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it.each([
    ["brand/kmbook-mark.png", 192],
    ["icons/icon-192.png", 192],
    ["icons/icon-512.png", 512],
    ["icons/icon-512-maskable.png", 512],
    ["icons/apple-touch-icon.png", 180],
  ])("existe %s como PNG de %ipx", (rel, px) => {
    const buf = fs.readFileSync(publicFile(rel));
    expect(buf.subarray(1, 4).toString()).toBe("PNG");
    expect(buf.readUInt32BE(16)).toBe(px);
    expect(buf.readUInt32BE(20)).toBe(px);
  });

  it("existe el favicon.ico oficial y no quedan iconos generados en runtime", () => {
    expect(fs.existsSync(path.join(process.cwd(), "src/app/favicon.ico"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "src/app/icon.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), "src/lib/brand-icon.tsx"))).toBe(false);
  });

  it("el service worker apunta a iconos que existen", () => {
    const sw = fs.readFileSync(publicFile("sw.js"), "utf8");
    const refs = [...sw.matchAll(/"(\/icons\/[^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(fs.existsSync(publicFile(ref.slice(1)))).toBe(true);
  });
});
