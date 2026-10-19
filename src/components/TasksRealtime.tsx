"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DEBOUNCE_MS = 400;

/**
 * Mantiene la jornada al día cuando Business asigna, cambia o cancela una tarea, sin cerrar sesión.
 *
 *  1. Supabase Realtime (solo tareas): cambios de `studio_internal_task_assignments` de la organización;
 *     la RLS entrega únicamente las filas de esta profesional.
 *  2. Respaldo sin sondeo: al volver a la pestaña o recuperar la red se vuelve a pedir la jornada.
 *
 * Es solo actualización de datos: no es una notificación push (no hay infraestructura push en Staff).
 */
export function TasksRealtime({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };

    let cleanup = () => {};
    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`staff-tasks-${organizationId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "studio_internal_task_assignments", filter: `organization_id=eq.${organizationId}` },
          refresh,
        )
        .subscribe();
      cleanup = () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      // Sin configuración de Supabase en el cliente: queda el respaldo.
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);

    return () => {
      cleanup();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [organizationId, router]);

  return null;
}
