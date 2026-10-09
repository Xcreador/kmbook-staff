"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  INITIAL_CONNECTION,
  PROBE_TIMEOUT_MS,
  isReadOnly,
  nextConnectionState,
  nextProbeDelay,
  outcomeFromStatus,
  type ConnectionState,
  type ProbeOutcome,
} from "@/lib/kmbook/connectivity";

export type Prober = () => Promise<ProbeOutcome>;

/** Sondeo real: HEAD a un endpoint propio, sin caché y con timeout. */
export const probeHealth: Prober = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch("/api/health", {
      method: "HEAD",
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    return outcomeFromStatus(response.status);
  } catch {
    return { kind: "network" };
  } finally {
    clearTimeout(timer);
  }
};

type ConnectivityValue = { state: ConnectionState; readOnly: boolean };
const DEFAULT_VALUE: ConnectivityValue = { state: INITIAL_CONNECTION, readOnly: false };
const ConnectivityContext = createContext<ConnectivityValue>(DEFAULT_VALUE);

export function useConnectivity(): ConnectivityValue {
  return useContext(ConnectivityContext);
}

/**
 * Un único monitor para toda la app. El estado vive solo en memoria (nunca en
 * localStorage/sessionStorage): al abrir la app se parte de «online» y se
 * comprueba de inmediato.
 */
export function ConnectivityProvider({ children, prober = probeHealth }: { children: React.ReactNode; prober?: Prober }) {
  const [state, setState] = useState<ConnectionState>(INITIAL_CONNECTION);
  const stateRef = useRef<ConnectionState>(INITIAL_CONNECTION);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const pendingRef = useRef(false);

  const schedule = useCallback((run: () => void) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(run, nextProbeDelay(stateRef.current));
  }, []);

  useEffect(() => {
    let disposed = false;

    const probe = async () => {
      if (disposed) return;
      if (runningRef.current) {
        // Evento (online, visible…) durante un sondeo en vuelo: repetir al terminar.
        pendingRef.current = true;
        return;
      }
      runningRef.current = true;
      let outcome: ProbeOutcome;
      try {
        outcome = await prober();
      } catch {
        outcome = { kind: "network" };
      }
      runningRef.current = false;
      if (disposed) return;
      const browserOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false;
      const next = nextConnectionState(stateRef.current, outcome, browserOnline);
      stateRef.current = next;
      setState((prev) => (prev.status === next.status && prev.failures === next.failures ? prev : next));
      if (pendingRef.current) {
        pendingRef.current = false;
        void probe();
      } else if (document.visibilityState !== "hidden") {
        schedule(probe);
      }
    };

    const probeNow = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void probe();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") probeNow();
      else if (timerRef.current) clearTimeout(timerRef.current);
    };

    window.addEventListener("online", probeNow);
    // «offline» solo es una pista: se confirma con el sondeo, no se asume.
    window.addEventListener("offline", probeNow);
    document.addEventListener("visibilitychange", onVisibility);
    probeNow();

    return () => {
      disposed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("online", probeNow);
      window.removeEventListener("offline", probeNow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [prober, schedule]);

  return <ConnectivityContext.Provider value={{ state, readOnly: isReadOnly(state) }}>{children}</ConnectivityContext.Provider>;
}
