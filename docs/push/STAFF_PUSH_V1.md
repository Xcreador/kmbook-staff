# KMBOOK Staff — Notificaciones Push V1

Reutiliza la infraestructura de Core ya en LIVE (Xcreador/kmbook PRs #274 y #276):
tabla `user_push_subscriptions`, RPC de alta/baja/preferencias/prueba, fan-out
bandeja → Push, worker `process-push-deliveries` y cron `kmbook-push-worker`.
**Sin migraciones, sin worker, cola ni cron nuevos y sin cambios en VAPID.**

## Auditoría del Service Worker previo

| Hallazgo | Riesgo | Corrección |
|---|---|---|
| Al pulsar abría `payload.data.url` sin validar | Las URL de Core son de Business (`/app/...`) y daban 404 en Staff; una URL absoluta se habría abierto tal cual | Traducción a rutas de Staff (`/appointments/{id}`, `/agenda`, `/today`, `/profile/push`, `/notifications`); sólo rutas propias |
| Mostraba `event.data.text()` si el payload no era JSON | Texto arbitrario en pantalla bloqueada | Texto por defecto genérico |
| Etiqueta sin validar | — | `[a-z0-9_-]{1,120}` (conserva la etiqueta por evento de Core: sin sustituciones entre avisos distintos) |
| `subscribeToPush()` existía pero nadie la usaba y nunca enviaba la suscripción al servidor | Push no funcional | Pantalla Perfil → Notificaciones + Server Actions |

## Implementación

- **`/profile/push`:** compatibilidad, permiso, estado, «Activar notificaciones»
  (el permiso sólo se pide al pulsar), «Enviar notificación de prueba», preferencias
  por tipo y dispositivos con «Desactivar». En iPhone/iPad sin instalar explica que
  hace falta añadir la PWA a la pantalla de inicio.
- **`src/app/actions/push.ts`:** la organización sale SIEMPRE de la organización
  activa verificada (`getStaffViewerContext`, membresía activa); nunca del navegador.
  Core vuelve a exigir membresía activa y filas propias.
- **Baja automática:** al cerrar sesión y al cambiar de negocio
  (`releasePushDevice`, cookie httpOnly con el **hash** del endpoint).
- **Etiqueta del dispositivo:** «Staff · Chrome en Android», para distinguirlo en el
  listado de Business.

## Eventos

Los mismos que Business, porque Core los entrega a la bandeja de la profesional:
cita reservada online, cancelada, reprogramada o reasignada (a las profesionales
asignadas) y tareas (asignada, modificada, reprogramada, cancelada o retirada). Texto genérico
sin datos de clientas. Una misma persona con Business y Staff recibe el aviso en
cada dispositivo suscrito: es intencionado y no son duplicados (una entrega por evento y persona).

## Seguridad multiempresa

- Alta en la organización activa verificada; un `organizationId` enviado por el navegador se ignora (test).
- Core: suscripción ligada a (organización, usuaria) con FK a la membresía; el worker
  revalida la membresía activa en cada envío; desactivar a un empleado revoca sus dispositivos (pgTAP en Core).
- Un endpoint pertenece a una sola cuenta (transferencia al registrarlo otra).
- La ficha de cita revalida sesión, negocio activo y acceso al abrir desde la notificación.

## Pruebas

- Vitest: 94 (22 nuevos: enrutado TS y SW con el archivo real, alta/baja, organización forzada, hash en cookie, baja al cerrar sesión, fallos de Core).
- `tsc`, ESLint y `next build` correctos.
- Chromium con entrega simulada por CDP y el payload exacto de Core: cita → `/appointments/{id}`, tarea → `/today`, prueba → `/profile/push` (`evidence/push-v1/`).
- Recepción real: **pendiente** de una profesional y un dispositivo autorizados.

## Prueba real (procedimiento)

1. Desplegar esta rama en Production de `kmbook-staff`, tras aprobar y fusionar la PR. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` ya existe.
2. En el móvil de la profesional autorizada: entrar en Staff → Perfil → Notificaciones →
   Activar → permitir. En iPhone, antes, añadir Staff a la pantalla de inicio.
3. «Enviar notificación de prueba»: llega en ≤ 1 min (cron) → al pulsar abre Perfil → Notificaciones.
4. Desde Business, asignar a esa profesional una cita de prueba: llega «Nueva cita…» y al pulsar se abre la ficha.
5. Con la app cerrada o en segundo plano, repetir el paso 4.
6. «Desactivar en este dispositivo» → nueva prueba: no llega. Cerrar sesión → no llega.
7. Verificación en la base (sólo lectura): entregas `sent` y `last_success_at` del dispositivo «Staff · …».

## Rollback

Revertir la PR. Las suscripciones de Staff que queden caducan solas
(404/410) o se desactivan desde Business → Notificaciones → Push → Dispositivos.
