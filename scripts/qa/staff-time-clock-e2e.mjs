// SÓLO QA LOCAL, DATOS SINTÉTICOS. KMBOOK Staff ↔ Core #117 de punta a punta.
//
// Requiere la base nativa de QA de KMBOOK Core con TODAS las migraciones
// (incluida 20261006140000_studio_staff_settings) y seed-agenda.mjs, y Staff
// compilado con esas variables y arrancado en :3002.
//   NODE_PATH=… CHROMIUM=… node scripts/qa/staff-time-clock-e2e.mjs <carpeta>
//
//   1  A OFF: Hoy sin «Mi fichaje», sin pestaña FICHAJE; /time-clock → no disponible
//   2  A ON (lo activa la owner con la RPC de Business): Hoy y FICHAJE visibles; ENTRAR ficha
//   3  A pasa a OFF con /time-clock abierto: el botón ya no escribe (servidor)
//   4  Cambio a B (OFF): sin fichaje; una pestaña antigua de A no puede fichar
//   5  Vuelta a A (ON): estado real de A (TRABAJANDO), sin residuo de B
//   6  Membresía de A inactiva: A deja de estar disponible; B (OFF) sin fichaje
//   7  Kiosk de recepción: sigue funcionando con el ajuste OFF
//   8  Staff no ofrece cambiar el ajuste; sin jerga técnica; sin errores de página
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServerClient } from "@supabase/ssr";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const out = process.argv[2] ?? "/tmp/staff-time-clock-e2e";
mkdirSync(out, { recursive: true });
const BASE = process.env.STAFF_URL ?? "http://127.0.0.1:3002";
const PASSWORD = process.env.QA_PASSWORD ?? "Kmbook-QA-2026!";
const seed = JSON.parse(readFileSync(process.env.QA_SEED ?? "/tmp/kmbook-qa-supabase/seed.json", "utf8"));
const ORG_A = seed.org;
const OWNER = seed.users.owner.id;
// Profesional del seed sin fichajes en A (el script se puede repetir sobre la
// misma base: cada ejecución usa una profesional «limpia»).
const LAURA = ["pro1", "pro2", "pro3", "pro4", "pro5"]
  .map((key) => seed.users[key])
  .find((user) => {
    const result = spawnSync("psql", ["-X", "-At", "-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-c",
      `select count(*) from public.studio_attendance_sessions where organization_id = '${ORG_A}' and user_id = '${user.id}'`], { encoding: "utf8" });
    return result.stdout.trim() === "0";
  });
if (!LAURA) throw new Error("Todas las profesionales del seed ya tienen fichajes: vuelve a crear la base de QA (down.sh, up.sh y seed-agenda.mjs).");
const RUN = Date.now().toString(36);

function psql(query, { allowError = false } = {}) {
  const result = spawnSync("psql", ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-c", query], { encoding: "utf8" });
  if (result.status !== 0 && !allowError) throw new Error(result.stderr);
  return { out: result.stdout.trim(), err: result.stderr.trim(), status: result.status };
}
const sql = (query) => psql(query).out;
const as = (user, query) => `begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${user}","role":"authenticated"}', true); ${query}; commit;`;
const setFlag = (org, value) => sql(as(OWNER, `select public.set_staff_organization_settings('${org}', ${value})`));
const openSessions = (org) => sql(`select count(*) from public.studio_attendance_sessions where organization_id = '${org}' and user_id = '${LAURA.id}' and status <> 'finished'`);
const breaks = (org) => sql(`select count(*) from public.studio_attendance_breaks b join public.studio_attendance_sessions s on s.id = b.session_id where s.organization_id = '${org}' and s.user_id = '${LAURA.id}'`);

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail: String(detail ?? "").slice(0, 300) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${String(detail).slice(0, 160)})` : ""}`);
}

// ── Fixtures sintéticos: organización B (de la owner) con Laura como profesional.
const ORG_A_NAME = sql(`select name from public.organizations where id = '${ORG_A}'`);
const ORG_B_NAME = `Salón B QA ${RUN}`;
const ORG_B = sql(as(OWNER, `select organization_id from public.create_organization('${ORG_B_NAME}', 'salon-b-qa-${RUN}', 'Centro B')`)).split("\n").filter((l) => /^[0-9a-f-]{36}$/.test(l)).pop();
sql(`insert into public.organization_memberships (organization_id, user_id, role) values ('${ORG_B}', '${LAURA.id}', 'professional')`);
setFlag(ORG_A, false);
setFlag(ORG_B, false);
const JARGON = ["get_staff_organization_settings", "staff_individual_time_clock_enabled", "42501", "Supabase", "RPC", "flag"];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-ES" });
context.setDefaultTimeout(60000);
context.setDefaultNavigationTimeout(120000);
const pageErrors = [];
const page = await context.newPage();
page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 160)));

async function go(path) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle").catch(() => {});
}
async function chooseOrganization(name) {
  await go("/select-organization");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.waitForURL((url) => url.pathname === "/today");
  await page.waitForLoadState("networkidle").catch(() => {});
}
const navHasTimeClock = async (p = page) => (await p.getByRole("link", { name: "FICHAJE" }).count()) > 0;
const todayHasTimeClock = async (p = page) => (await p.getByLabel("Control horario individual").count()) > 0;
const unavailable = async (p = page) => (await p.getByTestId("time-clock-unavailable").count()) > 0;
const noJargon = async (p = page) => {
  const text = await p.locator("body").innerText();
  return JARGON.filter((word) => text.includes(word));
};

/**
 * Sesión real de Laura. La pasarela nativa de QA no responde al preflight
 * CORS del login desde el navegador, así que se inicia sesión con
 * @supabase/ssr en Node (contra el mismo GoTrue) y se copian al navegador
 * exactamente las cookies que escribiría la app.
 */
async function signIn(email) {
  const written = [];
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [], setAll: (cookies) => written.push(...cookies) },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login QA: ${error.message}`);
  await context.addCookies(written.map(({ name, value }) => ({ name, value, url: BASE })));
}

try {
  await signIn(LAURA.email);

  // ── 1. A OFF ───────────────────────────────────────────────────────────
  await chooseOrganization(ORG_A_NAME);
  check("1: A OFF · Hoy sin «Mi fichaje»", !(await todayHasTimeClock()));
  check("1: A OFF · sin pestaña FICHAJE", !(await navHasTimeClock()));
  await go("/time-clock");
  check("1: A OFF · /time-clock directo → no disponible", await unavailable());
  check("1: A OFF · texto claro para la profesional", (await page.getByText("Fichaje desde este dispositivo no disponible").count()) > 0);
  check("1: A OFF · sin botón ENTRAR", (await page.getByRole("button", { name: "ENTRAR" }).count()) === 0);
  check("1: sin jerga técnica", (await noJargon()).length === 0, (await noJargon()).join(","));
  await page.screenshot({ path: `${out}/1-A-off-time-clock-390.png`, fullPage: true });

  // ── 2. A ON ────────────────────────────────────────────────────────────
  setFlag(ORG_A, true);
  await go("/today");
  check("2: A ON · Hoy muestra «Mi fichaje»", await todayHasTimeClock());
  check("2: A ON · pestaña FICHAJE visible", await navHasTimeClock());
  await page.screenshot({ path: `${out}/2-A-on-today-390.png`, fullPage: true });
  await go("/time-clock");
  check("2: A ON · /time-clock disponible", !(await unavailable()));
  await page.getByRole("button", { name: "ENTRAR" }).click();
  await page.getByText("Fichaje registrado.").waitFor();
  check("2: A ON · ENTRAR registra la jornada en Core", openSessions(ORG_A) === "1", openSessions(ORG_A));
  await page.screenshot({ path: `${out}/2-A-on-fichado-390.png`, fullPage: true });

  // ── 3. A pasa a OFF con la pantalla abierta ────────────────────────────
  setFlag(ORG_A, false);
  const breaksBefore = breaks(ORG_A);
  await page.getByRole("button", { name: /PAUSA/ }).first().click();
  await page.getByText(/Fichaje desde este dispositivo no disponible/).first().waitFor();
  check("3: OFF con la pantalla abierta · el servidor no registra la pausa", breaks(ORG_A) === breaksBefore, `${breaksBefore} → ${breaks(ORG_A)}`);
  check("3: la tarjeta deja de ofrecer PAUSA/SALIR", (await page.getByRole("button", { name: /PAUSA|SALIR/ }).count()) === 0);
  await page.getByTestId("time-clock-unavailable").waitFor({ timeout: 30000 }).catch(() => {});
  check("3: la pantalla se refresca a «no disponible»", await unavailable());
  await page.screenshot({ path: `${out}/3-A-off-pantalla-abierta-390.png`, fullPage: true });
  setFlag(ORG_A, true);

  // ── 4. Cambio a B (OFF) con una pestaña antigua de A ───────────────────
  const staleA = await context.newPage();
  staleA.on("pageerror", (error) => pageErrors.push(`staleA: ${String(error).slice(0, 160)}`));
  await staleA.goto(`${BASE}/time-clock`);
  await staleA.waitForLoadState("networkidle").catch(() => {});
  check("4: pestaña de A abierta con fichaje disponible", !(await unavailable(staleA)));
  await chooseOrganization(ORG_B_NAME);
  check("4: B OFF · Hoy sin «Mi fichaje»", !(await todayHasTimeClock()));
  check("4: B OFF · sin pestaña FICHAJE", !(await navHasTimeClock()));
  await go("/time-clock");
  check("4: B OFF · /time-clock → no disponible", await unavailable());
  const breaksA = breaks(ORG_A);
  await staleA.getByRole("button", { name: /PAUSA/ }).first().click();
  await staleA.getByText("Has cambiado de salón. Vuelve a abrir el fichaje.").waitFor();
  check("4: pestaña antigua de A no puede fichar tras pasar a B", breaks(ORG_A) === breaksA && openSessions(ORG_B) === "0");
  await staleA.screenshot({ path: `${out}/4-pestana-antigua-A-390.png`, fullPage: true });
  await staleA.close();

  // ── 5. Vuelta a A (ON) ────────────────────────────────────────────────
  await chooseOrganization(ORG_A_NAME);
  check("5: A ON · Hoy vuelve a mostrar «Mi fichaje»", await todayHasTimeClock());
  await go("/time-clock");
  check("5: A ON · estado real de A (Trabajando)", (await page.getByText(/Trabajando|TRABAJANDO/).count()) > 0);

  // ── 6. Membresía de A inactiva ─────────────────────────────────────────
  sql(`update public.organization_memberships set active = false where organization_id = '${ORG_A}' and user_id = '${LAURA.id}'`);
  await go("/time-clock");
  const html6 = await page.locator("body").innerText();
  const path6 = new URL(page.url()).pathname;
  // Sin A, Staff o bien activa la única organización restante (B, OFF → no
  // disponible) o bien pide elegir salón; en ningún caso queda fichaje de A.
  check("6: membresía de A inactiva · sin fichaje de A",
    (path6 === "/select-organization" || (await unavailable()))
      && !html6.includes(ORG_A_NAME)
      && !/TRABAJANDO|PAUSA|ENTRAR/.test(html6), `${path6}`);
  await page.screenshot({ path: `${out}/6-A-membresia-inactiva-390.png`, fullPage: true });
  const coreDenied = psql(as(LAURA.id, `select public.get_staff_organization_settings('${ORG_A}')`), { allowError: true });
  check("6: Core niega la lectura a la membresía inactiva", coreDenied.status !== 0 && coreDenied.err.includes("access_denied"), coreDenied.err.split("\n")[0]);
  sql(`update public.organization_memberships set active = true where organization_id = '${ORG_A}' and user_id = '${LAURA.id}'`);

  // ── 7. Kiosk ───────────────────────────────────────────────────────────
  setFlag(ORG_A, false);
  const roster = psql(as(OWNER, `select count(*) from public.studio_attendance_kiosk_roster('${ORG_A}')`), { allowError: true });
  check("7: Kiosk · el roster de recepción funciona con el ajuste OFF", roster.status === 0, roster.err.split("\n")[0]);

  // ── 8. Staff no cambia el ajuste ───────────────────────────────────────
  await go("/profile");
  check("8: Staff no ofrece cambiar el ajuste", (await page.getByText(/Permitir fichaje|Configuración de KMBOOK Staff/).count()) === 0);
  const write = psql(as(LAURA.id, `select public.set_staff_organization_settings('${ORG_A}', true)`), { allowError: true });
  check("8: Core rechaza el cambio a una profesional", write.status !== 0 && write.err.includes("authorization_required"), write.err.split("\n")[0]);
} finally {
  check("Sin errores de página", pageErrors.length === 0, pageErrors.join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}
