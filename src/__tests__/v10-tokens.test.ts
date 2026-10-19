import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const src = join(__dirname, "..");
const read = (p: string) => readFileSync(join(src, p), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "__tests__") walk(full, out);
    } else if (/\.(css|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const declared = (text: string) => new Set([...text.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));

describe("ST-02 — identidad visual heredada de Business V10", () => {
  const shared = new Set([...declared(read("styles/v10-tokens.css")), ...declared(read("app/globals.css"))]);

  it("todo token usado está definido en los tokens V10 o en el alias de Staff", () => {
    const missing: string[] = [];
    for (const file of walk(src)) {
      const text = readFileSync(file, "utf8");
      const local = declared(text);
      for (const m of text.matchAll(/var\((--[a-z0-9-]+)/gi)) {
        // --font-poppins la inyecta next/font en <html>.
        if (!shared.has(m[1]) && !local.has(m[1]) && m[1] !== "--font-poppins") missing.push(`${file.replace(src, "")}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("globals.css no redefine colores de marca: solo alias a los tokens V10", () => {
    const root = read("app/globals.css").slice(0, read("app/globals.css").indexOf("* {"));
    expect(root).not.toMatch(/--(km|color|status)-[a-z-]+:\s*#[0-9a-f]{3,8}/i);
    expect(root).toContain("--km-pink: var(--kmbook-action-accent)");
    expect(root).toContain("--km-oxford: var(--km-primary)");
  });

  it("los tokens V10 son un espejo del archivo de Business (acento CTA y Oxford)", () => {
    const v10 = read("styles/v10-tokens.css");
    expect(v10).toContain("--kmbook-action-accent: #e6006f");
    expect(v10).toContain("--kmbook-v10-oxford: #070023");
  });

  it("Poppins se carga con next/font, sin @import externo", () => {
    expect(read("app/globals.css")).not.toContain("googleapis");
    expect(read("app/layout.tsx")).toContain("next/font/google");
  });
});
