# KMBOOK Staff

App web instalable (PWA) del personal de KMBOOK, dominio `staff.kmbook.es`. Staff opera;
Business configura y administra permisos; Core controla y protege. Staff no concede
privilegios: los permisos se resuelven siempre con `has_studio_capability` de Core y Core
los revalida en destino.

## Variables de entorno

Ver `.env.example`.

| Variable | Ámbito | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | público | Proyecto Supabase (nunca `service_role`). |
| `KMBOOK_BUSINESS_URL` | solo servidor | Origen `https` de KMBOOK Business. Se valida (sin credenciales, ruta ni consulta; sin IP; `http` solo para `localhost` fuera de producción) y se normaliza a `origin`. **Si falta o no es válida, los accesos a Business se ocultan**: no existe URL por defecto. `NEXT_PUBLIC_BUSINESS_URL` se acepta solo por compatibilidad. |

## Accesos a Business (Perfil)

Se muestran por permiso real de Core, nunca por el nombre del rol:

- **Abrir TPV** (`/app/studio/pos`): `payment.collect` o `cash_register.access`. Solo el TPV.
- **Abrir KMBOOK Business** (`/app/studio`, gestión administrativa): `roles.manage`.

Un enlace oculto no sustituye la autorización: Core valida al llegar a Business.

## Conectividad y modo solo lectura

`navigator.onLine` no se usa como verdad. `ConnectivityProvider` sondea `HEAD /api/health`
(sin caché, timeout 5 s) con histéresis (2 fallos de red consecutivos) y backoff, y revalida
con `online`, `offline` y `visibilitychange`. Solo una desconexión real confirmada activa el
modo solo lectura; un 401, un 5xx o un error de consulta muestran su propio mensaje sin
bloquear. El estado no se persiste.

## Service worker

`public/sw.js` no cachea páginas, RSC ni APIs (siempre red). Solo cachea estáticos sin datos,
borra las cachés de versiones anteriores al activarse y se actualiza al volver a la app.

## Scripts

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
