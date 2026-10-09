// QA LOCAL sin datos: PWA + detección de conectividad en Chromium real (página /login,
// única que no requiere Core). Requiere Staff compilado y arrancado (npm run build && npm start).
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=<playwright> node scripts/qa/pwa-offline-e2e.mjs <carpeta> [CHROMIUM_EXE]
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const out = process.argv[2] ?? "/tmp/staff-pwa-e2e";
mkdirSync(out, { recursive: true });
const BASE = process.env.STAFF_URL ?? "http://127.0.0.1:3002";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: Boolean(ok), detail }); console.log(ok ? "OK  " : "FAIL", name, detail); };

const browser = await chromium.launch({ executablePath: process.argv[3] || undefined });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

// 1. manifest
const manifestRes = await context.request.get(`${BASE}/manifest.webmanifest`);
const manifest = await manifestRes.json();
check("manifest 200 y JSON", manifestRes.ok(), manifestRes.headers()["content-type"]);
check("manifest start_url=/?source=pwa, scope=/, standalone", manifest.start_url === "/?source=pwa" && manifest.scope === "/" && manifest.display === "standalone");
for (const icon of manifest.icons) {
  const r = await context.request.get(`${BASE}${icon.src}`);
  check(`icono ${icon.src} servido`, r.ok() && r.headers()["content-type"]?.includes("image/png"));
}
const swRes = await context.request.get(`${BASE}/sw.js`);
check("sw.js sin caché HTTP", swRes.ok() && /no-cache|no-store/.test(swRes.headers()["cache-control"] ?? ""), swRes.headers()["cache-control"]);
const health = await context.request.fetch(`${BASE}/api/health`, { method: "HEAD" });
check("/api/health HEAD 200 no-store", health.status() === 200 && /no-store/.test(health.headers()["cache-control"] ?? ""));

// 2. carga, SW registrado
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.waitForFunction(() => navigator.serviceWorker?.ready.then(() => true));
const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return { scope: reg.scope, active: Boolean(reg.active) };
});
check("service worker registrado y activo", sw.active, sw.scope);
const manifestLink = await page.evaluate(() => document.querySelector('link[rel="manifest"]')?.getAttribute("href"));
check("<link rel=manifest>", manifestLink === "/manifest.webmanifest", String(manifestLink));
const metas = await page.evaluate(() => ({
  apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href"),
  capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute("content") ?? document.querySelector('meta[name="mobile-web-app-capable"]')?.getAttribute("content"),
  status: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute("content"),
  viewport: document.querySelector('meta[name="viewport"]')?.getAttribute("content"),
  theme: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
}));
check("meta iPhone/tema presentes", metas.apple && metas.capable === "yes" && metas.status && /viewport-fit=cover/.test(metas.viewport) && metas.theme === "#070023", JSON.stringify(metas));
await page.waitForTimeout(500);
check("sin banner con red", (await page.locator('[data-connection]').count()) === 0);
await page.screenshot({ path: `${out}/1-online-login-390.png` });

// 3. sin conexión real (context.setOffline) -> banner tras histéresis, solo lectura
await context.setOffline(true);
await page.waitForSelector('[data-connection="offline"]', { timeout: 15000 });
const text = await page.locator('[data-connection="offline"]').innerText();
check("offline real: banner «Sin conexión — Modo solo lectura»", /Sin conexión/.test(text) && /solo lectura/.test(text), text);
await page.screenshot({ path: `${out}/2-offline-login-390.png` });

// 4. recuperación al volver online, sin recargar
await page.evaluate(() => { window.__noReload = true; });
await context.setOffline(false);
await page.waitForSelector('[data-connection]', { state: "detached", timeout: 15000 });
check("recuperación automática sin recargar", await page.evaluate(() => window.__noReload === true));
await page.screenshot({ path: `${out}/3-recuperada-login-390.png` });

// 5. falso positivo: navigator.onLine=false pero el servidor responde
await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }); window.dispatchEvent(new Event("offline")); });
await page.waitForTimeout(1500);
check("navigator.onLine=false con servidor vivo NO activa «sin conexión»", (await page.locator('[data-connection]').count()) === 0);

// 6. 401 en /api/health: sesión caducada, no «sin conexión»
await page.route("**/api/health", (route) => route.fulfill({ status: 401, body: "" }));
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.waitForSelector('[data-connection="session_expired"]', { timeout: 10000 });
check("401 → «Sesión caducada», no «Sin conexión»", !/Sin conexión/.test(await page.locator('[data-connection]').innerText()));
await page.screenshot({ path: `${out}/4-sesion-caducada-login-390.png` });
await page.unroute("**/api/health");

// 7. carga en frío con el servidor caído (setOffline de Playwright no afecta a las peticiones del
//    service worker, así que se detiene el servidor de QA): el SW responde «Sin conexión», nunca HTML cacheado.
spawnSync("sh", ["-c", "fuser -k 3002/tcp"]);
await new Promise((r) => setTimeout(r, 1500));
const resp = await page.goto(`${BASE}/today`).catch((e) => ({ error: String(e) }));
const body = await page.content();
check("recarga en frío sin servidor: página «Sin conexión» del SW (sin datos cacheados)", /KMBOOK Staff necesita conexión/.test(body) && !/MI JORNADA/.test(body), String(resp?.status?.() ?? resp?.error));
await page.screenshot({ path: `${out}/5-recarga-en-frio-sin-servidor-390.png` });

check("sin errores de página", pageErrors.length === 0, pageErrors.join(" | "));
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
