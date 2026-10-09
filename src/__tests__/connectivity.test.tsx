import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FAILURES_TO_CONFIRM,
  INITIAL_CONNECTION,
  POLL_INTERVAL_MS,
  connectionMessage,
  isReadOnly,
  nextConnectionState,
  nextProbeDelay,
  outcomeFromStatus,
  type ConnectionState,
  type ProbeOutcome,
} from "@/lib/kmbook/connectivity";
import { ConnectivityProvider, probeHealth } from "@/components/ConnectivityProvider";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useOffline } from "@/components/useOffline";

const NET: ProbeOutcome = { kind: "network" };
const OK: ProbeOutcome = { kind: "ok" };

describe("lógica pura de detección", () => {
  it("un sondeo correcto manda sobre navigator.onLine=false (falso positivo corregido)", () => {
    const s = nextConnectionState(INITIAL_CONNECTION, OK, false);
    expect(s).toEqual(INITIAL_CONNECTION);
    expect(isReadOnly(s)).toBe(false);
  });

  it("histéresis: un fallo aislado no cambia el estado visible", () => {
    const s = nextConnectionState(INITIAL_CONNECTION, NET, false);
    expect(s.status).toBe("online");
    expect(s.failures).toBe(1);
    expect(isReadOnly(s)).toBe(false);
  });

  it("fallos consecutivos con la señal del navegador caída → sin conexión (solo lectura)", () => {
    let s: ConnectionState = INITIAL_CONNECTION;
    for (let i = 0; i < FAILURES_TO_CONFIRM; i++) s = nextConnectionState(s, NET, false);
    expect(s.status).toBe("offline");
    expect(isReadOnly(s)).toBe(true);
  });

  it("fallos consecutivos con red del navegador → servidor sin respuesta, SIN solo lectura", () => {
    let s: ConnectionState = INITIAL_CONNECTION;
    for (let i = 0; i < FAILURES_TO_CONFIRM; i++) s = nextConnectionState(s, NET, true);
    expect(s.status).toBe("server_unreachable");
    expect(isReadOnly(s)).toBe(false);
  });

  it("recuperación inmediata con un solo sondeo correcto", () => {
    const offline: ConnectionState = { status: "offline", failures: 5 };
    expect(nextConnectionState(offline, OK, true)).toEqual(INITIAL_CONNECTION);
  });

  it("un fallo suelto tras recuperarse no vuelve a bloquear", () => {
    let s: ConnectionState = { status: "offline", failures: 5 };
    s = nextConnectionState(s, OK, true);
    s = nextConnectionState(s, NET, false);
    expect(s.status).toBe("online");
  });

  it("estados diferenciados por respuesta HTTP; ninguno es «sin conexión»", () => {
    expect(nextConnectionState(INITIAL_CONNECTION, outcomeFromStatus(401), false).status).toBe("session_expired");
    expect(nextConnectionState(INITIAL_CONNECTION, outcomeFromStatus(403), false).status).toBe("session_expired");
    expect(nextConnectionState(INITIAL_CONNECTION, outcomeFromStatus(503), false).status).toBe("server_unreachable");
    expect(nextConnectionState(INITIAL_CONNECTION, outcomeFromStatus(404), false).status).toBe("query_error");
    for (const code of [401, 403, 404, 500, 503]) {
      expect(isReadOnly(nextConnectionState({ status: "offline", failures: 3 }, outcomeFromStatus(code), false))).toBe(false);
    }
  });

  it("mensajes distintos por estado y ninguno cuando todo va bien", () => {
    const titles = (["offline", "server_unreachable", "session_expired", "query_error"] as const).map((s) => connectionMessage(s)?.title);
    expect(new Set(titles).size).toBe(4);
    expect(connectionMessage("offline")?.detail).toContain("Modo solo lectura");
    expect(connectionMessage("online")).toBeNull();
  });

  it("backoff exponencial acotado y sondeo lento cuando va bien", () => {
    expect(nextProbeDelay(INITIAL_CONNECTION)).toBe(POLL_INTERVAL_MS);
    expect(nextProbeDelay({ status: "online", failures: 1 })).toBe(2000);
    expect(nextProbeDelay({ status: "offline", failures: 2 })).toBe(4000);
    expect(nextProbeDelay({ status: "offline", failures: 3 })).toBe(8000);
    expect(nextProbeDelay({ status: "offline", failures: 50 })).toBe(30_000);
    expect(nextProbeDelay({ status: "session_expired", failures: 0 })).toBe(2000);
  });
});

describe("probeHealth", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("HEAD /api/health con cache no-store; 200 → ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await probeHealth()).toEqual({ kind: "ok" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/health");
    expect(init).toMatchObject({ method: "HEAD", cache: "no-store" });
  });

  it("401 → http 401 (nunca network)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    expect(await probeHealth()).toEqual({ kind: "http", status: 401 });
  });

  it("fetch rechazado → network", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await probeHealth()).toEqual({ kind: "network" });
  });

  it("timeout (abort) → network", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))))),
      );
      const p = probeHealth();
      await vi.advanceTimersByTimeAsync(5001);
      expect(await p).toEqual({ kind: "network" });
    } finally {
      vi.useRealTimers();
    }
  });
});

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
}

function Flag() {
  return <span data-testid="flag">{String(useOffline())}</span>;
}

describe("OfflineBanner + ConnectivityProvider (relojes simulados)", () => {
  let outcomes: ProbeOutcome[];
  let calls: number;
  const prober = async () => {
    calls++;
    return outcomes.length > 1 ? outcomes.shift()! : outcomes[0];
  };

  const mount = async () => {
    render(
      <ConnectivityProvider prober={prober}>
        <OfflineBanner />
        <Flag />
      </ConnectivityProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  };
  const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  const flag = () => screen.getByTestId("flag").textContent;

  beforeEach(() => {
    vi.useFakeTimers();
    calls = 0;
    outcomes = [OK];
    setNavigatorOnline(true);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setNavigatorOnline(true);
  });

  it("navigator.onLine=false pero el servidor responde → sin banner ni solo lectura", async () => {
    setNavigatorOnline(false);
    await mount();
    expect(screen.queryByRole("status")).toBeNull();
    expect(flag()).toBe("false");
  });

  it("desconexión real: un fallo no parpadea; el segundo confirma; vuelve solo al recuperar la red", async () => {
    setNavigatorOnline(false);
    outcomes = [NET];
    await mount();
    expect(screen.queryByRole("status")).toBeNull(); // 1.er fallo: histéresis
    await advance(2000); // reintento con backoff
    expect(screen.getByRole("status").textContent).toContain("Sin conexión");
    expect(screen.getByRole("status").textContent).toContain("Modo solo lectura");
    expect(flag()).toBe("true");

    // La red vuelve: evento «online» → revalida sin recargar.
    outcomes = [OK];
    setNavigatorOnline(true);
    await act(async () => { window.dispatchEvent(new Event("online")); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByRole("status")).toBeNull();
    expect(flag()).toBe("false");
  });

  it("recupera también por el reintento con backoff, sin evento online", async () => {
    setNavigatorOnline(false);
    outcomes = [NET, NET, OK];
    await mount();
    await advance(2000);
    expect(flag()).toBe("true");
    await advance(4000);
    expect(flag()).toBe("false");
  });

  it("revalida al volver a primer plano (visibilitychange)", async () => {
    setNavigatorOnline(false);
    outcomes = [NET, NET, OK];
    await mount();
    await advance(2000);
    expect(flag()).toBe("true");
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(0); });
    expect(flag()).toBe("false");
  });

  it("un 401 NO activa «sin conexión»: mensaje de sesión caducada, sin solo lectura", async () => {
    outcomes = [{ kind: "http", status: 401 }];
    await mount();
    const banner = screen.getByRole("status");
    expect(banner.textContent).toContain("Sesión caducada");
    expect(banner.textContent).not.toContain("Sin conexión");
    expect(banner.getAttribute("data-connection")).toBe("session_expired");
    expect(flag()).toBe("false");
  });

  it("un error de consulta / 5xx NO activa solo lectura y muestra su propio mensaje", async () => {
    outcomes = [{ kind: "http", status: 500 }];
    await mount();
    expect(screen.getByRole("status").textContent).toContain("KMBOOK no responde");
    expect(flag()).toBe("false");
  });

  it("servidor sin respuesta con red del navegador: mensaje propio, sin solo lectura", async () => {
    outcomes = [NET];
    await mount();
    await advance(2000);
    expect(screen.getByRole("status").textContent).toContain("KMBOOK no responde");
    expect(flag()).toBe("false");
  });

  it("no persiste nada entre sesiones", async () => {
    setNavigatorOnline(false);
    outcomes = [NET];
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    await mount();
    await advance(2000);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("sondea periódicamente (60 s) cuando va bien", async () => {
    await mount();
    const initial = calls;
    await advance(POLL_INTERVAL_MS + 10);
    expect(calls).toBeGreaterThan(initial);
  });

  it("sin proveedor, useOffline es false (no bloquea)", () => {
    render(<Flag />);
    expect(flag()).toBe("false");
  });
});
