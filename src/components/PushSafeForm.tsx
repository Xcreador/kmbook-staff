"use client";

import { useTransition, type FormEvent, type ReactNode } from "react";

import { releaseBrowserPush } from "@/lib/kmbook/push";

/**
 * Formulario para cerrar sesión o cambiar de negocio. Antes de enviar la
 * acción del servidor anula la suscripción Push de ESTE navegador (si
 * `releasePush`), de modo que el dispositivo deja de recibir los avisos de la
 * cuenta/negocio saliente aunque la baja en Core falle. La acción se envía
 * siempre: Push nunca bloquea salir ni cambiar de negocio.
 */
export function PushSafeForm({
  action,
  releasePush = true,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  releasePush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [, startTransition] = useTransition();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (releasePush) await releaseBrowserPush();
    startTransition(async () => {
      await action(formData);
    });
  }

  return (
    <form action={action} className={className} onSubmit={onSubmit}>
      {children}
    </form>
  );
}
