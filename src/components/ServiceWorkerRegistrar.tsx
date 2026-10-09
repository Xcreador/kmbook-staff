"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/kmbook/push";

/** Registra el service worker en TODAS las páginas (también Login), no solo tras iniciar sesión. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
