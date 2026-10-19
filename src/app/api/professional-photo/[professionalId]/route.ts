import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/kmbook/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Fotografía del profesional configurada en KMBOOK Business.
 *
 * Misma fuente que Business (`studio_professional_photos`, vía la RPC
 * `get_studio_professional_photo`): Staff no guarda ni duplica imágenes. La RPC exige ser
 * miembro de la organización, así que una foto nunca sale hacia otra empresa. La URL lleva la
 * versión (`v`): al cambiar la foto en Business cambia la URL y la caché privada se renueva.
 */
const paramsSchema = z.object({ organization: z.string().uuid(), professionalId: z.string().uuid() });
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function GET(request: NextRequest, context: { params: Promise<{ professionalId: string }> }) {
  const parsed = paramsSchema.safeParse({
    organization: request.nextUrl.searchParams.get("organization"),
    professionalId: (await context.params).professionalId,
  });
  if (!parsed.success) return new NextResponse(null, { status: 404 });
  if (!(await getAuthenticatedUser())) return new NextResponse(null, { status: 401 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_studio_professional_photo", {
    p_organization_id: parsed.data.organization,
    p_professional_id: parsed.data.professionalId,
  });
  const photo = !error ? data?.[0] : null;
  if (!photo || !IMAGE_TYPES.includes(photo.content_type)) return new NextResponse(null, { status: 404 });

  return new NextResponse(Buffer.from(photo.data_base64, "base64"), {
    headers: {
      "content-type": photo.content_type,
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}
