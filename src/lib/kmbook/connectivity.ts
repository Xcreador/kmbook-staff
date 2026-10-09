/**
 * Detección de conectividad de KMBOOK Staff (lógica pura, sin DOM ni red).
 *
 * `navigator.onLine` NO es fiable: marca «sin red» con VPN, tras reactivar un
 * iPhone/Android en una PWA o cuando solo hay una interfaz local, y no avisa
 * de cuándo vuelve la red. Por eso se usa solo como pista y la decisión se
 * toma con una comprobación activa contra `/api/health` (sin caché):
 *
 *  - Un sondeo correcto manda sobre `navigator.onLine`: vuelve a «online» al
 *    instante (recuperación rápida).
 *  - Pasar a «sin conexión» exige varios fallos de red consecutivos
 *    (histéresis) para no parpadear con un fallo puntual.
 *  - Estados DIFERENCIADOS: sin red real, servidor sin respuesta, sesión
 *    caducada (401/403) y respuesta inesperada. Solo «sin red» confirmada
 *    pone la app en modo solo lectura; los demás NO bloquean operaciones.
 *  - Nada se persiste entre sesiones.
 */

export type ConnectionStatus = "online" | "offline" | "server_unreachable" | "session_expired" | "query_error";

export type ConnectionState = {
  status: ConnectionStatus;
  /** Fallos de red consecutivos del sondeo. */
  failures: number;
};

export type ProbeOutcome =
  | { kind: "ok" }
  | { kind: "network" } // fetch rechazado o timeout
  | { kind: "http"; status: number };

export const INITIAL_CONNECTION: ConnectionState = { status: "online", failures: 0 };

/** Fallos de red consecutivos necesarios antes de declarar un estado de fallo. */
export const FAILURES_TO_CONFIRM = 2;
export const PROBE_TIMEOUT_MS = 5000;
export const POLL_INTERVAL_MS = 60_000;
export const BACKOFF_BASE_MS = 2000;
export const BACKOFF_MAX_MS = 30_000;

/** Convierte la respuesta HTTP del sondeo en un resultado. */
export function outcomeFromStatus(status: number): ProbeOutcome {
  return status >= 200 && status < 300 ? { kind: "ok" } : { kind: "http", status };
}

/**
 * Transición del estado ante un resultado de sondeo.
 * `browserOnline` es la pista de `navigator.onLine`: solo decide la etiqueta
 * («sin red» frente a «servidor sin respuesta»), nunca por sí sola.
 */
export function nextConnectionState(state: ConnectionState, outcome: ProbeOutcome, browserOnline: boolean): ConnectionState {
  if (outcome.kind === "ok") return INITIAL_CONNECTION;

  if (outcome.kind === "http") {
    // El servidor respondió: hay red. Nunca es «sin conexión».
    if (outcome.status === 401 || outcome.status === 403) return { status: "session_expired", failures: 0 };
    if (outcome.status >= 500) return { status: "server_unreachable", failures: 0 };
    return { status: "query_error", failures: 0 };
  }

  const failures = state.failures + 1;
  if (failures < FAILURES_TO_CONFIRM) {
    // Aún no confirmado: se conserva el estado visible (sin parpadeo).
    return { status: state.status, failures };
  }
  return { status: browserOnline ? "server_unreachable" : "offline", failures };
}

/** Modo solo lectura: SOLO con desconexión real confirmada. */
export function isReadOnly(state: ConnectionState): boolean {
  return state.status === "offline";
}

/** Espera hasta el siguiente sondeo: backoff exponencial si hay fallos, sondeo lento si todo va bien. */
export function nextProbeDelay(state: ConnectionState): number {
  if (state.failures === 0 && state.status === "online") return POLL_INTERVAL_MS;
  const exponent = Math.max(0, state.failures - 1);
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** exponent);
}

export type ConnectionMessage = { title: string; detail: string };

/** Mensajes distintos por estado. `null` cuando todo va bien. */
export function connectionMessage(status: ConnectionStatus): ConnectionMessage | null {
  switch (status) {
    case "offline":
      return { title: "Sin conexión", detail: "Modo solo lectura activado. Las acciones de modificación están bloqueadas hasta recuperar la red." };
    case "server_unreachable":
      return { title: "KMBOOK no responde", detail: "Tienes red, pero el servidor no contesta. Reintentando automáticamente." };
    case "session_expired":
      return { title: "Sesión caducada", detail: "Vuelve a iniciar sesión para continuar." };
    case "query_error":
      return { title: "Respuesta inesperada", detail: "El servicio ha devuelto un error. Reintentando automáticamente." };
    default:
      return null;
  }
}
