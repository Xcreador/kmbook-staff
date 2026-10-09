/**
 * Comprobación de vida para la detección de conectividad de Staff.
 * Pública, sin sesión, sin datos y SIN caché: solo responde si el servidor vive.
 * No consulta Supabase a propósito: un fallo de base de datos o de sesión no
 * debe confundirse con una desconexión.
 */
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store, max-age=0" };

export function GET() {
  return Response.json({ ok: true }, { headers });
}

export function HEAD() {
  return new Response(null, { status: 200, headers });
}
