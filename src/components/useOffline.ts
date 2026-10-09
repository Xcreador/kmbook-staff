"use client";

import { useConnectivity } from "./ConnectivityProvider";

/**
 * `true` SOLO con desconexión real confirmada por el monitor de conectividad
 * (sondeo activo + histéresis), no por `navigator.onLine`. Un 401, un fallo de
 * consulta o un servidor lento no activan el modo solo lectura.
 */
export function useOffline(): boolean {
  return useConnectivity().readOnly;
}
